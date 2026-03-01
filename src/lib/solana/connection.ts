import { Connection } from '@solana/web3.js';
import { RPC_ENDPOINTS } from '../constants';

/**
 * Tactical RPC Relay: Rotates through available endpoints on failure.
 * Includes a 5s timeout guard and detects rate-limiting / auth issues.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Shared state for global RPC health
let vortexDegraded = false;
let lastDegradedTime = 0;
const DEGRADED_COOLDOWN = 60000; // 60s cooldown for noisy errors

/**
 * Tactical RPC Relay: Rotates through available endpoints on failure.
 * Includes a 5s timeout guard and detects rate-limiting / auth issues.
 */
export const getResilientConnection = async <T>(operation: (conn: Connection, endpoint: string) => Promise<T>): Promise<T> => {
    let lastError: any;

    if (RPC_ENDPOINTS.length === 0) {
        throw new Error("VORTEX_FATAL: No RPC endpoints configured.");
    }

    // Priority: Always try Helius first if it's top of the list
    const primary = RPC_ENDPOINTS[0]; // Usually Helius from constants.ts
    const fallbacks = RPC_ENDPOINTS.slice(1).sort(() => Math.random() - 0.5);
    const shuffled = [primary, ...fallbacks];

    const now = Date.now();
    if (vortexDegraded && now - lastDegradedTime > DEGRADED_COOLDOWN) {
        vortexDegraded = false;
        console.warn("VORTEX_INFRASTRUCTURE: Attempting recovery from degraded status...");
    }

    for (let i = 0; i < shuffled.length; i++) {
        const endpoint = shuffled[i];
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

                // If we hit auth or rate limits, log it and try the next one, but add a small tactical pause
                // to prevent CPU-intensive tight loops if all endpoints are failing.
                if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('429')) {
                    vortexDegraded = true;
                    lastDegradedTime = Date.now();

                    if (vortexDegraded) {
                        // Silent failure: Don't spam warnings in the console if we're already degraded
                        lastError = e;
                    } else {
                        console.warn(`RPC_ISSUE [${endpoint}]: ${errorMessage}. Rotating...`);
                        lastError = e;
                    }

                    // Tactical cooldown: longer wait for auth/rate issues
                    if (i < shuffled.length - 1) {
                        await sleep(1000);
                    }
                    continue;
                }

                throw e;
            }
        } catch (e) {
            lastError = e;
            console.warn(`RPC_UPLINK_FAILURE [${endpoint}]:`, e);
            if (i < shuffled.length - 1) await sleep(200);
            continue;
        }
    }

    // If we reach here, total infrastructure failure. Throw and trigger global UI fallback.
    throw lastError || new Error("CRITICAL_SYSTEM_FAILURE: ALL_RPC_ENDPOINTS_OFFLINE");
};
