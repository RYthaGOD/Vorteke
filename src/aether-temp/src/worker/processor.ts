import { db } from '../db/client';
import { SwapEvent } from './parser';
import { PubSub } from 'graphql-subscriptions';
import { AlphaDiscovery } from './alpha_discovery';

export const pubsub = new PubSub();

export class DataProcessor {
    /**
     * The heart of AetherIndex. 
     * Processes swaps from any source (gRPC, Webhook, WS Fallback) 
     * ensuring consistency and broadcasting live updates.
     */
    static async processSwap(event: SwapEvent) {
        try {
            console.log(`[Processor] Processing ${event.dex.toUpperCase()} swap: ${event.signature.slice(0, 8)}...`);

            // 1. Persistence
            await db.insertSwapToSQLite(event);
            await db.insertToDuckDB([event]);

            // 2. Real-time Broadcast
            await pubsub.publish('SWAP_UPDATED', { newSwap: event });
            await pubsub.publish(`PRICE_UPDATED_${event.tokenOut}`, { 
                priceUpdated: {
                    window_start: event.blockTime.toISOString(),
                    open: event.priceUsd,
                    high: event.priceUsd,
                    low: event.priceUsd,
                    close: event.priceUsd,
                    volume: event.amountOut * event.priceUsd
                }
            });

            // 3. Alpha Discovery (Async background trace)
            // Triggered on every swap to identify serial ruggers or suspicious clusters
            AlphaDiscovery.traceCreator(event.maker, event.tokenOut).catch(() => {});

            return true;
        } catch (err) {
            console.error('[Processor] Failed to process swap:', err);
            return false;
        }
    }
}
