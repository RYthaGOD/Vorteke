import axios from 'axios';
import { config } from '../config';
import { db } from '../db/client';

export class AlphaDiscovery {
    /**
     * Rug Detection & Creator Clustering.
     * Traces the funding source of a token creator to identify serial ruggers.
     */
    static async traceCreator(creator: string, mint: string) {
        try {
            console.log(`[AlphaDiscovery] Tracing creator: ${creator} for mint: ${mint}`);
            
            // 1. Fetch Funding Source via Helius Wallet API
            const fundingResponse = await axios.get(`https://api.helius.xyz/v1/addresses/${creator}/funded-by?api-key=${config.helius.apiKey}`);
            const fundedBy = fundingResponse.data?.fundingSource || 'Unknown/Direct';
            
            // 2. Cluster Analysis: How many tokens has this creator launched?
            const creatorAssets = await axios.post(`https://mainnet.helius-rpc.com/?api-key=${config.helius.apiKey}`, {
                jsonrpc: "2.0",
                id: "creator-assets",
                method: "getAssetsByCreator",
                params: {
                    creatorAddress: creator,
                    onlyVerified: false,
                    limit: 100
                }
            });

            const launchCount = creatorAssets.data.result?.total || 1;
            
            // 3. Heuristic: Reputation based on launch density & funding
            let reputation = 'CLEAN';
            if (launchCount > 10) reputation = 'SUSPICIOUS';
            if (fundedBy.toLowerCase().includes('mixer') || fundedBy.toLowerCase().includes('tornado')) reputation = 'RUGGER';

            console.log(`[AlphaDiscovery] Creator: ${creator} | Funded: ${fundedBy} | Status: ${reputation}`);

            // 4. Persistence to SQLite
            await db.updateCreatorReputation(creator, reputation, fundedBy, launchCount);

            return { reputation, fundedBy, launchCount };
        } catch (err) {
            console.error('[AlphaDiscovery] Tracing failed:', err);
            return null;
        }
    }
}
