import express from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import { config } from '../config';
import { db } from '../db/client';

const typeDefs = gql`
    type Token {
        mint: String
        symbol: String
        name: String
        decimals: Int
    }

    type Ohlcv {
        window_start: String
        open: Float
        high: Float
        low: Float
        close: Float
        volume: Float
    }

    type Subscription {
        priceUpdated(tokenAddress: String!): Ohlcv
        newSwap: Swap
    }

    type Swap {
        signature: String
        tokenIn: String
        tokenOut: String
        amountIn: Float
        amountOut: Float
        priceUsd: Float
        dex: String
    }

    type TopMover {
        tokenAddress: String
        current_price: Float
        pct_change: Float
    }

    type VolumeCluster {
        tokenAddress: String
        total_volume: Float
        trade_count: Int
    }

    type Query {
        getHistory(tokenAddress: String!, interval: String!): [Ohlcv]
        searchTokens(query: String!): [Token]
        getTopMovers: [TopMover]
        getVolumeClusters: [VolumeCluster]
    }
`;

const resolvers = {
    Query: {
        getHistory: async (_: any, { tokenAddress, interval }: { tokenAddress: string, interval: string }) => {
            try {
                const history = await db.getHistory(tokenAddress, interval);
                return history;
            } catch (err) {
                console.error('Error fetching history:', err);
                return [];
            }
        },
        searchTokens: async (_: any, { query }: { query: string }) => {
            try {
                return await db.searchTokens(query);
            } catch (err) {
                console.error('Error searching tokens:', err);
                return [];
            }
        },
        getTopMovers: async () => {
            try {
                return await db.getTopMovers();
            } catch (err) {
                console.error('Error fetching top movers:', err);
                return [];
            }
        },
        getVolumeClusters: async () => {
            try {
                return await db.getVolumeClusters();
            } catch (err) {
                console.error('Error fetching volume clusters:', err);
                return [];
            }
        }
    },
    Subscription: {
        priceUpdated: {
            subscribe: (_: any, { tokenAddress }: { tokenAddress: string }) => {
                return (pubsub as any).asyncIterator([`PRICE_UPDATED_${tokenAddress}`]);
            }
        },
        newSwap: {
            subscribe: () => (pubsub as any).asyncIterator(['SWAP_UPDATED'])
        }
    }
};

import { createServer } from 'http';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { pubsub } from '../worker/processor';
import { WebhookReceiver } from './receiver';
import { WebhookManager } from '../worker/webhook_manager';
import { PriceOracle } from '../worker/parser';

// ... defined typeDefs and resolvers ...

async function startServer() {
    const app = express();
    const httpServer = createServer(app);
    
    const schema = makeExecutableSchema({ typeDefs, resolvers });

    const server = new ApolloServer({ 
        schema,
        plugins: [{
            async serverWillStart() {
                return {
                    async drainServer() {
                        subscriptionServer.close();
                    }
                };
            }
        }],
    });

    const subscriptionServer = SubscriptionServer.create(
        { schema, execute, subscribe },
        { server: httpServer, path: server.graphqlPath }
    );

    await db.init();
    await server.start();
    server.applyMiddleware({ app: app as any });

    // Healthcheck for Railway Probes
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Initialize Sovereign Components (Non-blocking)
    try {
        WebhookReceiver.setup(app as any);
        await WebhookManager.orchestrate().catch(e => console.error('Webhook Orchestration Failed (Non-critical):', e));
        await PriceOracle.refreshSolPrice().catch(e => console.error('Price Refresh Failed (Non-critical):', e));
    } catch (err) {
        console.error('⚠️ Minor Startup Component Error:', err);
    }

    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
        console.log(`🚀 Gateway ready at http://localhost:${PORT}${server.graphqlPath}`);
        console.log(`📡 Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
    });
}

startServer().catch(err => {
    console.error('❌ Critical Server Startup Error:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
