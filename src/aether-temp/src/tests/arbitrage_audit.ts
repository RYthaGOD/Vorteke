import { PublicKey } from '@solana/web3.js';
import { solanaConnection } from '../config';

async function finalArbitrageAudit() {
    console.log('--- AETHERINDEX: DEFINITIVE ARBITRAGE AUDIT ---');
    console.log('Target: SOL/USDC (Mainnet)\n');

    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    const dexes = [
        {
            name: 'Raydium V4',
            address: new PublicKey('58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2'),
            config: { type: 'raydium', vaultA: 336, vaultB: 368 }
        },
        {
            name: 'Orca Whirlpool',
            address: new PublicKey('Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE'),
            config: { type: 'orca', sqrtPrice: 65, mintA: 101, mintB: 133 }
        },
        {
            name: 'Meteora DLMM',
            address: new PublicKey('BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y'),
            config: { type: 'meteora', activeId: 137, mintX: 88, mintY: 120, binStep: 8 }
        }
    ];

    const results: any[] = [];

    for (const dex of dexes) {
        try {
            console.log(`[${dex.name}] Analyzing...`);
            const info = await solanaConnection.getAccountInfo(dex.address);
            if (!info) continue;

            let price = 0;

            if (dex.config.type === 'raydium') {
                const vA = new PublicKey(info.data.slice(336, 336 + 32));
                const vB = new PublicKey(info.data.slice(368, 368 + 32));
                const [balA, balB] = await Promise.all([
                    solanaConnection.getTokenAccountBalance(vA),
                    solanaConnection.getTokenAccountBalance(vB)
                ]);
                price = (balB.value.uiAmount || 0) / (balA.value.uiAmount || 1);
            } 
            else if (dex.config.type === 'orca') {
                const sqrtPriceX64 = BigInt('0x' + info.data.slice(65, 81).reverse().toString('hex'));
                const sqrtPrice = Number(sqrtPriceX64) / Math.pow(2, 64);
                const rawPrice = Math.pow(sqrtPrice, 2);
                price = rawPrice * Math.pow(10, 9 - 6);
            } 
            else if (dex.config.type === 'meteora') {
                const binStep = info.data.readUInt16LE(8);
                const activeId = info.data.readInt32LE(137);
                const rawPrice = Math.pow(1 + binStep / 10000, activeId);
                price = rawPrice * Math.pow(10, 9 - 6);
            }

            if (price > 0) {
                results.push({ name: dex.name, price });
                console.log(` ✅ RESOLVED SPOT: $${price.toFixed(4)}`);
            }
        } catch (err: any) {
            console.error(` ❌ Failed for ${dex.name}:`, err.message);
        }
    }

    if (results.length > 1) {
        console.log('\n--- FINAL AUDIT ANALYSIS ---');
        results.sort((a,b) => b.price - a.price);
        for(const r of results) console.log(`${r.name.padEnd(15)}: $${r.price.toFixed(4)}`);
        
        const min = results[results.length-1].price;
        const max = results[0].price;
        const drift = ((max - min) / min) * 100;

        console.log(`\nMax Alignment Drift: ${drift.toFixed(4)}%`);
        if (drift < 0.1) {
            console.log('✅ Institutional Grade (Perfect Alignment).');
        } else if (drift < 0.5) {
            console.log('⚠️ High-Fidelity Alignment (Low Drift).');
        } else {
            console.log('❌ Strategic Divergence Detected.');
        }
    }
}

finalArbitrageAudit().catch(console.error);
