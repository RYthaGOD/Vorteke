import { aetherClient } from '../lib/vortex/aetherClient';

async function verifyAetherIntegration() {
    console.log("🚀 Starting AetherIndex Integration Verification...");

    const TEST_MINT = 'So11111111111111111111111111111111111111112'; // SOL

    try {
        console.log(`\n1. Testing searchTokens for ${TEST_MINT}...`);
        const searchRes = await aetherClient.searchTokens(TEST_MINT);
        console.log("Search Result:", searchRes);

        console.log(`\n2. Testing getHistory for ${TEST_MINT}...`);
        const historyRes = await aetherClient.getHistory(TEST_MINT, '1 day');
        console.log(`History Candles Found: ${historyRes.length}`);
        if (historyRes.length > 0) {
            console.log("Latest Candle:", historyRes[0]);
        }

        console.log("\n3. Testing getTopMovers...");
        const movers = await aetherClient.getTopMovers();
        console.log(`Top Movers Found: ${movers.length}`);

        console.log("\n4. Testing getVolumeClusters...");
        const clusters = await aetherClient.getVolumeClusters();
        console.log(`Volume Clusters Found: ${clusters.length}`);

        console.log("\n✅ AetherIndex Integration Verification Completed Successfully!");
    } catch (err) {
        console.error("\n❌ Verification Failed:", err);
    }
}

verifyAetherIntegration();
