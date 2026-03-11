import { Connection } from '@solana/web3.js';
import { RPC_ENDPOINTS, RPC_HEARTBEAT_INTERVAL, RPC_LATENCY_THRESHOLD } from '../constants';

export interface RPCStatus {
    endpoint: string;
    latency: number;
    lastSlot: number;
    isHealthy: boolean;
    lastHeard: number;
    errorCount: number;
}

/**
 * RPCManager: The Neural Core of VORTEX Resilience.
 * Manages global RPC health, performs background heartbeats, and 
 * provides the optimal uplink for any given transaction or query.
 */
class RPCManager {
    private static instance: RPCManager;
    private statusMap: Map<string, RPCStatus> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private isProbing: boolean = false;

    private constructor() {
        this.initializeStatus();
        if (typeof window !== 'undefined') {
            this.startHeartbeat();
        }
    }

    public static getInstance(): RPCManager {
        if (!RPCManager.instance) {
            RPCManager.instance = new RPCManager();
        }
        return RPCManager.instance;
    }

    private initializeStatus() {
        RPC_ENDPOINTS.forEach(endpoint => {
            this.statusMap.set(endpoint, {
                endpoint,
                latency: 9999,
                lastSlot: 0,
                isHealthy: true,
                lastHeard: 0,
                errorCount: 0
            });
        });
    }

    private async probe(endpoint: string): Promise<void> {
        const start = Date.now();
        const status = this.statusMap.get(endpoint);
        if (!status) return;

        try {
            const conn = new Connection(endpoint, 'confirmed');

            // Parallel probe for slot and health
            const [slot, health] = await Promise.all([
                conn.getSlot(),
                (conn as any).getHealth ? (conn as any).getHealth().catch(() => 'ok') : Promise.resolve('ok')
            ]);

            const duration = Date.now() - start;

            // Weighted Moving Average (Smoothing jitter)
            const smoothedLatency = status.latency === 9999 ? duration : (status.latency * 0.7) + (duration * 0.3);

            this.statusMap.set(endpoint, {
                ...status,
                latency: smoothedLatency,
                lastSlot: slot,
                isHealthy: health === 'ok',
                lastHeard: Date.now(),
                errorCount: 0
            });
        } catch (e) {
            this.statusMap.set(endpoint, {
                ...status,
                isHealthy: false,
                errorCount: status.errorCount + 1,
                latency: 9999
            });
            console.warn(`RPC_PROBE_FAIL [${endpoint}]:`, e);
        }
    }

    private async runHeartbeat() {
        if (this.isProbing) return;
        this.isProbing = true;

        try {
            await Promise.all(RPC_ENDPOINTS.map(e => this.probe(e)));
            this.pruneCache();
        } finally {
            this.isProbing = false;
        }
    }

    public startHeartbeat() {
        if (this.heartbeatInterval) return;
        this.runHeartbeat(); // Immediate first probe
        this.heartbeatInterval = setInterval(() => this.runHeartbeat(), RPC_HEARTBEAT_INTERVAL);
    }

    public stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Returns the best available endpoint based on latency, slot height, and health.
     */
    public getBestEndpoint(): string {
        const sorted = Array.from(this.statusMap.values())
            .filter(s => s.isHealthy)
            .sort((a, b) => {
                // Priority 1: Huge slot lags are unacceptable (forks/stalls)
                const slotDiff = b.lastSlot - a.lastSlot;
                if (Math.abs(slotDiff) > 10) return slotDiff; // higher slot first

                // Priority 2: Latency
                return a.latency - b.latency;
            });

        return sorted[0]?.endpoint || RPC_ENDPOINTS[0];
    }

    public reportError(endpoint: string) {
        const status = this.statusMap.get(endpoint);
        if (status) {
            this.statusMap.set(endpoint, {
                ...status,
                errorCount: status.errorCount + 1,
                latency: Math.min(9999, status.latency + 500) // Penalize error
            });
        }
    }

    public getAllStatus(): RPCStatus[] {
        return Array.from(this.statusMap.values());
    }

    /**
     * Shadow Caching: Minimal in-memory cache for high-frequency metadata.
     */
    private cache: Map<string, { data: any; expiry: number }> = new Map();

    public getCache<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (item && item.expiry > Date.now()) return item.data as T;
        if (item) this.cache.delete(key);
        return null;
    }

    public setCache(key: string, data: any, ttlMs: number = 5000) {
        this.cache.set(key, { data, expiry: Date.now() + ttlMs });
    }

    private pruneCache() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (item.expiry <= now) {
                this.cache.delete(key);
            }
        }
        // Hard limit: if cache is still too big, clear least recent (simplistic)
        if (this.cache.size > 100) {
            const keys = Array.from(this.cache.keys());
            keys.slice(0, keys.length - 100).forEach(k => this.cache.delete(k));
        }
    }
}

export const rpcManager = RPCManager.getInstance();
