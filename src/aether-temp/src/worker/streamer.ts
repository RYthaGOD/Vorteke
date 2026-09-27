import { solanaConnection, config } from '../config';
import { db } from '../db/client';
import { PriceOracle } from './parser';
import { SocketGuardian } from './guardian';
import axios from 'axios';

export class Streamer {
    private isRunning: boolean = false;
    private guardian: SocketGuardian;

    constructor() {
        this.guardian = new SocketGuardian();
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        console.log('Initializing Sovereign Indexer (Flawless Expansion Mode)...');
        
        // 1. Initialize Database
        await db.init();

        // 2. Warming up the Oracle
        console.log('[Streamer] Initializing Price Oracle...');
        await PriceOracle.refreshSolPrice();
        setInterval(() => PriceOracle.refreshSolPrice(), 60000); // Refresh every minute

        // 3. Start the Socket Guardian (Synthetic gRPC)
        console.log('[Streamer] Launching Socket Guardian...');
        await this.guardian.start();

        console.log('[Streamer] AetherIndex is now LIVE and Sovereign.');
    }

    private metadataQueue: Set<string> = new Set();
    private async queueMetadataEnrichment(mint: string) {
        if (this.metadataQueue.has(mint)) return;
        this.metadataQueue.add(mint);
        
        setTimeout(async () => {
            try {
                console.log(`[Discovery] Enriching Metadata via DAS: ${mint}`);
                
                const response = await axios.post(`https://mainnet.helius-rpc.com/?api-key=${config.helius.apiKey}`, {
                    jsonrpc: "2.0",
                    id: "my-id",
                    method: "getAsset",
                    params: {
                        id: mint,
                        displayOptions: { showFungible: true }
                    }
                });

                const metadata = response.data.result;
                if (metadata && metadata.content) {
                    const info = {
                        mint,
                        symbol: metadata.content.metadata?.symbol || 'UNKNOWN',
                        name: metadata.content.metadata?.name || 'Unknown Token',
                        decimals: metadata.token_info?.decimals || 9
                    };
                    
                    await db.upsertToken(info);
                    console.log(`[Discovery] Successfully Enriched: ${info.symbol}`);
                }
            } catch (err) {
                console.error(`[Discovery] DAS Enrichment Failed for ${mint}:`, err);
            } finally {
                this.metadataQueue.delete(mint);
            }
        }, 2000); 
    }
}

if (require.main === module) {
    const streamer = new Streamer();
    streamer.start().catch(console.error);
}

if (require.main === module) {
    const streamer = new Streamer();
    streamer.start().catch(console.error);
}
