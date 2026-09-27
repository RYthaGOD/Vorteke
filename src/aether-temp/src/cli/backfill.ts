import { solanaConnection } from '../config';
import { SwapParser } from '../worker/parser';
import { DataProcessor } from '../worker/processor';
import { PublicKey } from '@solana/web3.js';

/**
 * Sovereign Re-Sync CLI.
 * Allows force-re-synching specific slot ranges if the indexer was offline.
 * Makes the system a source of truth that can reconstruct state.
 */
async function backfill(startSlot: number, endSlot: number) {
    console.log(`--- Sovereign Re-Sync Started: Slot ${startSlot} to ${endSlot} ---`);
    
    let currentSlot = startSlot;
    const BATCH_SIZE = 10;

    while (currentSlot <= endSlot) {
        console.log(`[Backfill] Processing batch: ${currentSlot} to ${currentSlot + BATCH_SIZE}...`);
        
        try {
            // 1. Fetch block with full transaction details
            const block = await solanaConnection.getParsedBlock(currentSlot, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            });

            if (block && block.transactions) {
                console.log(`[Backfill] Found ${block.transactions.length} transactions at slot ${currentSlot}`);
                
                for (const tx of block.transactions) {
                    const swaps = await SwapParser.parseTransaction(tx as any);
                    for (const swap of swaps) {
                        await DataProcessor.processSwap(swap);
                    }
                }
            }
        } catch (err) {
            console.warn(`[Backfill] Skip slot ${currentSlot}:`, (err as any).message);
        }

        currentSlot++;
    }

    console.log('✅ Sovereign Re-Sync Complete.');
    process.exit(0);
}

const args = process.argv.slice(2);
const start = parseInt(args[0]);
const end = parseInt(args[1]);

if (isNaN(start) || isNaN(end)) {
    console.log('Usage: npx ts-node src/cli/backfill.ts <startSlot> <endSlot>');
    process.exit(1);
}

backfill(start, end).catch(err => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
});
