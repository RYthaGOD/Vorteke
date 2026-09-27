import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { aetherClient } from '../src/lib/vortex/aetherClient';

dotenv.config();

const prisma = new PrismaClient();
const TOKEN_ADDRESS = '3jdbFoiZhqk9KdYR8xM1ALgkCBJm3jKk9sZrxc8vpump';

async function main() {
    console.log(`🚀 INITIATING ELITE UPGRADE FOR ${TOKEN_ADDRESS}...`);

    try {
        // 1. Fetch live data from DexScreener to seed Token table
        console.log("Fetching live data from DexScreener...");
        const dexRes = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`);
        const pair = dexRes.data?.pairs?.[0];

        if (!pair) {
            throw new Error("COULD_NOT_RESOLVE_PAIR: Ensure token address is correct on DexScreener.");
        }

        const tokenInfo = {
            address: TOKEN_ADDRESS,
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            priceUsd: parseFloat(pair.priceUsd || '0'),
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            liquidityUsd: pair.liquidity?.usd || 0,
            fdv: pair.fdv || 0,
            mcap: pair.fdv || 0,
            logoURI: pair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${TOKEN_ADDRESS}.png`,
            securityTags: ['AGGREGRATED_SOURCE', 'VERIFIED_DEX'],
            lastUpdated: new Date()
        };

        // 2. Upsert into Token Table
        console.log("Upserting Token Record...");
        await prisma.token.upsert({
            where: { address: TOKEN_ADDRESS },
            update: tokenInfo,
            create: tokenInfo
        });

        // 3. Upsert into Enhancement Table
        console.log("Upserting Elite Enhancement...");
        await prisma.enhancement.upsert({
            where: { address: TOKEN_ADDRESS },
            update: {
                tier: 'Elite',
                socials: {
                    twitter: pair.info?.socials?.find((s: any) => s.type === 'twitter')?.url || '',
                    telegram: pair.info?.socials?.find((s: any) => s.type === 'telegram')?.url || '',
                    website: pair.info?.websites?.[0]?.url || ''
                },
                customDescription: "Promoted Elite Asset. Real-time telemetry engaged.",
                bannerURI: '/images/banners/elite_promoted.png',
                iconURI: pair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${TOKEN_ADDRESS}.png`,
                lastPaymentTime: new Date()
            },
            create: {
                address: TOKEN_ADDRESS,
                tier: 'Elite',
                socials: {
                    twitter: pair.info?.socials?.find((s: any) => s.type === 'twitter')?.url || '',
                    telegram: pair.info?.socials?.find((s: any) => s.type === 'telegram')?.url || '',
                    website: pair.info?.websites?.[0]?.url || ''
                },
                customDescription: "Promoted Elite Asset. Real-time telemetry engaged.",
                bannerURI: '/images/banners/elite_promoted.png',
                iconURI: pair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${TOKEN_ADDRESS}.png`,
                lastPaymentTime: new Date()
            }
        });

        console.log("✅ DATABASE_RECORDS_UPDATED");

        // 4. Trigger Aether Indexing
        console.log("Triggering Aether Indexing...");
        const triggerSuccess = await aetherClient.triggerIndexing(TOKEN_ADDRESS);
        
        if (triggerSuccess) {
            console.log("✅ INDEXING_TRIGGERED_SUCCESSFULLY");
        } else {
            console.warn("⚠️ INDEXING_TRIGGER_FAILED: Aether service might be offline or unresponsive.");
        }

        console.log("\n--- VERIFICATION ITEMS ---");
        console.log(`- Banner: /images/banners/elite_promoted.png`);
        console.log(`- Tier: Elite`);
        console.log(`- Aether Indexing: ${triggerSuccess ? 'OK' : 'PENDING'}`);

    } catch (err: any) {
        console.error("❌ UPGRADE_FAILED:", err.message || err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
