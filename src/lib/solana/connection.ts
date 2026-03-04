import { Connection } from '@solana/web3.js';
import { RPC_ENDPOINTS } from '../constants';

/**
 * Tactical RPC Relay: Rotates through available endpoints on failure.
 * Includes a 5s timeout guard and detects rate-limiting / auth issues.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Shared state for global RPC health and performance
let vortexDegraded = false;
let lastDegradedTime = 0;
const DEGRADED_COOLDOWN = 60000; // 60s cooldown for noisy errors
const latencyMap = new Map<string, number>();

/**
 * Tactical RPC Relay: Rotates through available endpoints on failure.
 * Enhanced with real-time latency scoring to prioritize the fastest uplink.
 */
export const getResilientConnection = async <T>(operation: (conn: Connection, endpoint: string) => Promise<T>): Promise<T> => {
    let lastError: any;

    if (RPC_ENDPOINTS.length === 0) {
        throw new Error("VORTEX_FATAL: No RPC endpoints configured.");
    }

    // Dynamic Prioritization: Sort endpoints by known latency (performance-first)
    const sortedEndpoints = [...RPC_ENDPOINTS].sort((a, b) => {
        const latA = latencyMap.get(a) || 9999;
        const latB = latencyMap.get(b) || 9999;
        return latA - latB;
    });

    // Add slight randomness to prevent "thundering herd" on a single fast RPC
    const fallbacks = sortedEndpoints.slice(1).sort(() => Math.random() - 0.2);
    const shuffled = [sortedEndpoints[0], ...fallbacks];

    const now = Date.now();
    if (vortexDegraded && now - lastDegradedTime > DEGRADED_COOLDOWN) {
        vortexDegraded = false;
        console.warn("VORTEX_INFRASTRUCTURE: Attempting recovery from degraded status...");
    }

    for (let i = 0; i < shuffled.length; i++) {
        const endpoint = shuffled[i];
        const start = Date.now();

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

                // Update Latency Intelligence
                const duration = Date.now() - start;
                const prevLatency = latencyMap.get(endpoint) || duration;
                // Weighted moving average for stability: 80% old, 20% new
                latencyMap.set(endpoint, (prevLatency * 0.8) + (duration * 0.2));

                return result;
            } catch (e: any) {
                clearTimeout(timeoutId);
                const errorMessage = e.message?.toLowerCase() || '';

                // Penalize failing/slow endpoints
                latencyMap.set(endpoint, (latencyMap.get(endpoint) || 1000) + 1000);

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
            latencyMap.set(endpoint, 9999); // Mark as effectively dead
            if (i < shuffled.length - 1) await sleep(200);
            continue;
        }
    }

    throw lastError || new Error("CRITICAL_SYSTEM_FAILURE: ALL_RPC_ENDPOINTS_OFFLINE");
};
