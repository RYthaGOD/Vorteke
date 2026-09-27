import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
    solana: {
        rpcUrl: process.env.SOLANA_RPC_URL || process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
        wsUrl: process.env.SOLANA_WS_URL || process.env.WSS_URL || 'wss://api.mainnet-beta.solana.com',
        // Secondary sources for Synthetic gRPC redundancy
        secondarySources: [
            { 
                rpc: process.env.RPC_SOURCE_2 || '', 
                ws: process.env.WS_SOURCE_2 || '' 
            },
            { 
                rpc: process.env.RPC_SOURCE_3 || '', 
                ws: process.env.WS_SOURCE_3 || '' 
            }
        ].filter(s => s.rpc !== '')
    },
    helius: {
        apiKey: process.env.HELIUS_API_KEY || '',
        webhookUrl: process.env.HELIUS_WEBHOOK_URL || '',
        webhookSecret: process.env.HELIUS_WEBHOOK_SECRET || '',
    },
    sqlite: {
        filename: process.env.SQLITE_DB_PATH || './data/sqlite/sovereign.db',
    },
    duckdb: {
        filename: process.env.DUCKDB_PATH || './data/parquet/analytics.duckdb',
    },
    redis: {
        // Now optional or used for local pub/sub only
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    }
};

export const solanaConnection = new Connection(config.solana.rpcUrl, {
    wsEndpoint: config.solana.wsUrl,
    commitment: 'confirmed',
});
