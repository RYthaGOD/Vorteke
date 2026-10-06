import axios from 'axios';
import { config } from '../config';

export class WebhookManager {
    private static HELIUS_API_URL = 'https://api.helius.xyz/v0/webhooks';

    /**
     * Automatically registers or updates the Helius webhook on startup.
     * Ensures the "Sovereign" indexer is zero-config.
     */
    static async orchestrate() {
        if (!config.helius.apiKey || !config.helius.webhookUrl) {
            console.log('[WebhookManager] Missing credentials, skipping orchestration.');
            return;
        }

        try {
            const { data: existingWebhooks } = await axios.get(`${this.HELIUS_API_URL}?api-key=${config.helius.apiKey}`);
            
            const existing = existingWebhooks.find((w: any) => w.webhookURL === config.helius.webhookUrl);

            const webhookConfig = {
                webhookURL: config.helius.webhookUrl,
                transactionTypes: ["SWAP"],
                accountAddresses: [
                    '675k1q2u71c6u2kzjd5L54Vf7U2z6u64f8D22C1u66v', // Raydium
                    'JUP6LkbZbZ9zaS8fXmBaWpHiPshNreDks5DWB6E9p6v'  // Jupiter
                ],
                webhookType: "enhanced"
            };

            if (existing) {
                console.log('[WebhookManager] Updating existing webhook...');
                await axios.put(`${this.HELIUS_API_URL}/${existing.webhookID}?api-key=${config.helius.apiKey}`, webhookConfig);
            } else {
                console.log('[WebhookManager] Creating new production webhook...');
                await axios.post(`${this.HELIUS_API_URL}?api-key=${config.helius.apiKey}`, webhookConfig);
            }
            
            console.log('✅ Helius Webhook Orchestrated Successfully.');
        } catch (err: any) {
            console.error('[WebhookManager] Orchestration failed:', err.response?.data || err.message);
        }
    }
}
