import { Connection } from '@solana/web3.js';
import { RPC_ENDPOINTS, RPC_LATENCY_THRESHOLD } from '../constants';
import { rpcManager } from './rpcManager';

/**
 * Tactical RPC Relay: Rotates through available endpoints on failure.
 * Includes a 8s timeout guard and detects rate-limiting / auth issues.
 * Powered by RPCManager for predictive failover and health matrix intelligence.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Shared state for global RPC health status
let vortexDegraded = false;
let lastDegradedTime = 0;
const DEGRADED_COOLDOWN = 60000; // 60s cooldown for noisy errors

/**
 * Tactical RPC Relay: Rotates through available endpoints on failure.
 * Enhanced with RPCManager intelligence for prioritized uplink selection.
 */
export const getResilientConnection = async <T>(operation: (conn: Connection, endpoint: string) => Promise<T>): Promise<T> => {
    let lastError: any;

    if (RPC_ENDPOINTS.length === 0) {
        throw new Error("VORTEX_FATAL: No RPC endpoints configured.");
    }

    const now = Date.now();
    if (vortexDegraded && now - lastDegradedTime > DEGRADED_COOLDOWN) {
        vortexDegraded = false;
        console.warn("VORTEX_INFRASTRUCTURE: Attempting recovery from degraded status...");
    }

    // ELITE_UPLINK_PRIORITY: If Helius is configured, it MUST be the primary source for production reliability.
    const heli = RPC_ENDPOINTS.find(e => e.includes('helius'));
    const bestEndpoint = rpcManager.getBestEndpoint();
    const shuffled = heli ? [heli, ...RPC_ENDPOINTS.filter(e => e !== heli)] : [bestEndpoint, ...RPC_ENDPOINTS.filter(e => e !== bestEndpoint)];

    for (let i = 0; i < shuffled.length; i++) {
        const endpoint = shuffled[i];

        // ELITE_BLOCK_BYPASS: The public 'api.mainnet-beta.solana.com' is currently 403-blocking production.
        // We skip it if we have other options to prevent unnecessary 8s timeouts.
        if (endpoint.includes('mainnet-beta.solana.com') && shuffled.length > 1 && !vortexDegraded) {
            continue;
        }

        // PREEMPTIVE_FAILOVER: If the "best" endpoint is suddenly exceeding threshold, 
        // and we have fallbacks, skip it before even attempting the operation.
        const status = rpcManager.getAllStatus().find(s => s.endpoint === endpoint);
        if (status && status.latency > RPC_LATENCY_THRESHOLD && i < shuffled.length - 1) {
            console.debug(`PREEMPTIVE_FAILOVER: Skipping slow endpoint [${endpoint}] (Latency: ${status.latency.toFixed(0)}ms)`);
            continue;
        }

        try {
            const conn = new Connection(endpoint, 'confirmed');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                const result = await Promise.race([
                    operation(conn, endpoint),
                    new Promise<never>((_, reject) => {
                        controller.signal.addEventListener('abort', () => reject(new Error('RPC_TIMEOUT')));
                    })
                ]);

                clearTimeout(timeoutId);
                return result;
            } catch (e: any) {
                clearTimeout(timeoutId);
                const errorMessage = e.message?.toLowerCase() || '';

                // Report failure to RPCManager to trigger penalization
                rpcManager.reportError(endpoint);

                if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('429')) {
                    vortexDegraded = true;
                    lastDegradedTime = Date.now();
                    lastError = e;
                    if (i < shuffled.length - 1) await sleep(1000);
                    continue;
                }

                throw e;
            }
        } catch (e) {
            lastError = e;
            console.warn(`RPC_UPLINK_FAILURE [${endpoint}]:`, e);
            rpcManager.reportError(endpoint);
            if (i < shuffled.length - 1) await sleep(200);
            continue;
        }
    }

    throw lastError || new Error("CRITICAL_SYSTEM_FAILURE: ALL_RPC_ENDPOINTS_OFFLINE");
};
