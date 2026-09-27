import { EventEmitter } from 'events';
import { VortexTx } from '../dataService';

/**
 * Vortex Streaming Service (VSS)
 * A centralized industrial-grade event hub for real-time market data.
 * Bridges upstream indexers (Aether/Helius) to SSE and WebSocket clients.
 */
class StreamingService extends EventEmitter {
    private static instance: StreamingService;
    private activeTokens: Map<string, { count: number, interval?: NodeJS.Timeout }> = new Map();

    private constructor() {
        super();
        this.setMaxListeners(5000); // Scale for high-concurrency tactical operations
    }

    public static getInstance(): StreamingService {
        if (!StreamingService.instance) {
            StreamingService.instance = new StreamingService();
        }
        return StreamingService.instance;
    }

    /**
     * Broadcasts a live transaction to all subscribers of a specific token.
     */
    public broadcastTx(tokenAddress: string, tx: VortexTx) {
        this.emit(`tx:${tokenAddress}`, tx);
        // Also emit to a global discovery channel for the Discovery Hub
        this.emit('discovery:pulse', { tokenAddress, tx });
    }

    /**
     * Reference counting: Track a token for a new subscriber.
     */
    public async trackToken(address: string) {
        let state = this.activeTokens.get(address);
        if (!state) {
            state = { count: 0 };
            this.activeTokens.set(address, state);
        }
        
        state.count++;

        if (state.count === 1) {
            console.log(`[VSS] INITIALIZING_TACTICAL_RECON: ${address}`);
            
            // SOVEREIGN_RECON_TRIGGER: Ensure AetherIndex is actively monitoring this asset.
            try {
                // Tactical Dynamic Import to avoid circular dependencies and ESM/CJS pathing issues
                const { aetherClient } = await import('./aetherClient');
                aetherClient.triggerIndexing(address).catch((err: any) => {
                    console.warn(`[VSS] Aether trigger background failure for ${address}:`, err.message);
                });
            } catch (e: any) {
                console.warn(`[VSS] Aether client import failed:`, e.message);
            }

            // Only real upstream events may call broadcastTx. An idle feed stays empty.
        }
    }

    /**
     * Reference counting: Stop tracking a token when no subscribers remain.
     */
    public untrackToken(address: string) {
        const state = this.activeTokens.get(address);
        if (!state) return;

        state.count--;
        if (state.count <= 0) {
            console.log(`[VSS] DEACTIVATING_RECON: ${address}`);
            if (state.interval) clearInterval(state.interval);
            this.activeTokens.delete(address);
        }
    }
}

export const streamingService = StreamingService.getInstance();
