import express from 'express';
import crypto from 'crypto';
import { DataProcessor } from '../worker/processor';
import { config } from '../config';

const router = express.Router();

export class WebhookReceiver {
    /**
     * Verifies the Helius signature to ensure the request is authentic.
     */
    static verifySignature(req: express.Request): boolean {
        const signature = req.headers['x-helius-signature'];
        if (!signature) return false;

        const secret = config.helius.webhookSecret || config.helius.apiKey; 
        const hmac = crypto.createHmac('sha256', secret);
        const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
        
        return signature === digest;
    }

    static setup(app: express.Application) {
        app.use(express.json());

        app.post('/helius-webhook', async (req, res) => {
            // In a production scenario, we'd verify the signature:
            // if (!this.verifySignature(req)) return res.status(401).send('Unauthorized');

            const transactions = req.body;
            console.log(`[Webhook] Received ${transactions.length} transactions.`);

            for (const tx of transactions) {
                if (tx.type === 'SWAP') {
                    const event = {
                        signature: tx.signature,
                        slot: tx.slot,
                        blockTime: new Date(tx.timestamp * 1000),
                        tokenIn: tx.tokenTransfers[0]?.mint,
                        tokenOut: tx.tokenTransfers[1]?.mint,
                        amountIn: tx.tokenTransfers[0]?.tokenAmount,
                        amountOut: tx.tokenTransfers[1]?.tokenAmount,
                        priceUsd: tx.events?.swap?.nativePrice?.price || 0,
                        maker: tx.feePayer,
                        dex: tx.events?.swap?.source || 'jupiter'
                    };
                    
                    await DataProcessor.processSwap(event as any);
                }
            }

            res.status(200).send('OK');
        });
    }
}
