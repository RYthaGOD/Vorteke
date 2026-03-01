import { Connection, ParsedInstruction, PublicKey } from '@solana/web3.js';
import { SOL_MINT } from '../constants';

export interface DecodedSwap {
    type: 'BUY' | 'SELL';
    amountSol: number;
    amountUsd: number;
    tokenAmount: number;
    signer: string;
}

/**
 * High-precision Solana instruction decoder for Vortex Elite.
 * Extracts "True SOL" from balance deltas of the signer.
 */
export async function decodeVortexSwap(
    connection: Connection,
    signature: string,
    tokenAddress: string
): Promise<DecodedSwap | null> {
    try {
        const tx = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });

        if (!tx || !tx.meta || !tx.transaction.message.accountKeys) return null;

        // 1. Universal Signer Recon (Crucial for Bot Routed Trades like Trojan/BananaGun)
        // Router bots sign the transaction on behalf of the user, so index 0 is the BOT program, 
        // not necessarily the end-user's wallet holding the token account. We must track all signers.
        const signers = tx.transaction.message.accountKeys
            .map((k, idx) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.signer, index: idx }))
            .filter(k => k.isSigner);

        const signerPubkeys = signers.map(s => s.pubkey);
        if (signerPubkeys.length === 0) return null; // Unlikely, but protective

        const postTokenBalances = tx.meta.postTokenBalances || [];
        const preTokenBalances = tx.meta.preTokenBalances || [];

        // 2. Universal Token Delta Recon
        // We calculate the net token flow across ALL accounts controlled by ALL signers.
        let tokenNetChange = 0;

        postTokenBalances.forEach(post => {
            if (post.mint === tokenAddress && post.owner && signerPubkeys.includes(post.owner)) {
                tokenNetChange += post.uiTokenAmount.uiAmount || 0;
            }
        });

        preTokenBalances.forEach(pre => {
            if (pre.mint === tokenAddress && pre.owner && signerPubkeys.includes(pre.owner)) {
                tokenNetChange -= pre.uiTokenAmount.uiAmount || 0;
            }
        });

        if (tokenNetChange === 0) return null; // No swap detected for this specific token

        // 3. Universal SOL Delta Recon
        // Calculate total SOL spent or received across all signers.
        let solPre = 0;
        let solPost = 0;

        signers.forEach(s => {
            solPre += tx.meta!.preBalances[s.index] || 0;
            solPost += tx.meta!.postBalances[s.index] || 0;
        });

        const fee = tx.meta.fee || 0;

        // If a signer LOSES SOL (post < pre), they spent SOL (Buy).
        // If a signer GAINS SOL (post > pre), they received SOL (Sell).
        // The fee was paid by a signer, so it artificially inflated the SOL drop. We subtract it back out to find true swap value.
        const solDeltaRaw = solPost - solPre; // Negative = spent SOL, Positive = gained SOL
        const solDeltaAdjusted = solDeltaRaw < 0 ? Math.abs(solDeltaRaw) - fee : Math.abs(solDeltaRaw) + fee;
        const solDelta = solDeltaAdjusted / 1e9;

        // 4. Stablecoin (USDC/USDT) Recon for true Whale volume bypass
        const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

        const getSignerTokenDelta = (mint: string) => {
            let delta = 0;
            postTokenBalances.forEach(post => {
                if (post.mint === mint && post.owner && signerPubkeys.includes(post.owner)) delta += post.uiTokenAmount.uiAmount || 0;
            });
            preTokenBalances.forEach(pre => {
                if (pre.mint === mint && pre.owner && signerPubkeys.includes(pre.owner)) delta -= pre.uiTokenAmount.uiAmount || 0;
            });
            return Math.abs(delta);
        };

        const amountUsd = getSignerTokenDelta(USDC_MINT) + getSignerTokenDelta(USDT_MINT);

        // Heuristic: If it's an extreme stablecoin swap disguised as a low-sol hop, derive a "SOL equivalent"
        let computedSol = solDelta;
        if (amountUsd > 10 && solDelta < 0.05) {
            try {
                const solPriceRes = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
                const solPriceData = await solPriceRes.json();
                const currentSolPrice = parseFloat(solPriceData?.data?.['So11111111111111111111111111111111111111112']?.price || '185');
                computedSol = amountUsd / currentSolPrice;
            } catch (e) {
                computedSol = amountUsd / 185; // Absolute unbreakable fallback
            }
        }

        return {
            type: tokenNetChange > 0 ? 'BUY' : 'SELL', // Net gained tokens = BUY event
            amountSol: parseFloat(computedSol.toFixed(6)),
            amountUsd: parseFloat(amountUsd.toFixed(2)),
            tokenAmount: Math.abs(tokenNetChange),
            signer: signerPubkeys[0] // Return primary signer for address tracking
        };
    } catch (e) {
        console.error("DECODER_FAILURE:", e);
        return null;
    }
}
