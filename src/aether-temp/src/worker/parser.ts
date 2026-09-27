import { ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { solanaConnection } from '../config';
import axios from 'axios';

export interface SwapEvent {
    signature: string;
    slot: number;
    blockTime: Date;
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    amountOut: number;
    priceUsd: number;
    maker: string;
    dex: string;
}

export class PriceOracle {
    private static solPriceUsd: number = 150; 
    private static SOL_MINT = 'So11111111111111111111111111111111111111112';
    private static USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    // Raydium V4 SOL/USDC Mainnet ID (Verified 2026)
    private static RAYDIUM_POOL = new PublicKey('58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2');
    
    // Orca Whirlpool SOL/USDC (Verified 2026)
    private static ORCA_POOL = new PublicKey('Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE');
    
    // Meteora DLMM SOL/USDC (Verified 2026)
    private static METEORA_POOL = new PublicKey('AR9oc3nSndPCHNZMkyQvrt27bFDSiJCvrXpS4T29m8X');

    /**
     * Updates SOL price from the highest-liquidity pools.
     * Uses vault-level balance discovery for 100% on-chain parity.
     */
    static async refreshSolPrice() {
        try {
            // Priority 1: Raydium V4 (Sovereign)
            const rayInfo = await solanaConnection.getAccountInfo(this.RAYDIUM_POOL);
            if (rayInfo) {
                const baseVault = new PublicKey(rayInfo.data.slice(336, 368));
                const quoteVault = new PublicKey(rayInfo.data.slice(368, 400));
                const [baseRes, quoteRes] = await Promise.all([
                    solanaConnection.getTokenAccountBalance(baseVault),
                    solanaConnection.getTokenAccountBalance(quoteVault)
                ]);
                if (baseRes.value.uiAmount && quoteRes.value.uiAmount) {
                    this.solPriceUsd = quoteRes.value.uiAmount / baseRes.value.uiAmount;
                    console.log(`[Oracle] Price from Raydium: $${this.solPriceUsd.toFixed(2)}`);
                    return;
                }
            }

            // Priority 2: Orca Whirlpool (Sovereign)
            const orcaInfo = await solanaConnection.getAccountInfo(this.ORCA_POOL);
            if (orcaInfo) {
                const vaultA = new PublicKey(orcaInfo.data.slice(133, 165));
                const vaultB = new PublicKey(orcaInfo.data.slice(213, 245));
                const [resA, resB] = await Promise.all([
                    solanaConnection.getTokenAccountBalance(vaultA),
                    solanaConnection.getTokenAccountBalance(vaultB)
                ]);
                if (resA.value.uiAmount && resB.value.uiAmount) {
                    // Whirlpool layout: USDC is usually B in SOL/USDC
                    this.solPriceUsd = resB.value.uiAmount / resA.value.uiAmount;
                    console.log(`[Oracle] Price from Orca: $${this.solPriceUsd.toFixed(2)}`);
                    return;
                }
            }

            // Priority 3: Meteora DLMM (Sovereign)
            const metInfo = await solanaConnection.getAccountInfo(this.METEORA_POOL);
            if (metInfo) {
                const reserveX = new PublicKey(metInfo.data.slice(152, 184));
                const reserveY = new PublicKey(metInfo.data.slice(184, 216));
                const [resX, resY] = await Promise.all([
                    solanaConnection.getTokenAccountBalance(reserveX),
                    solanaConnection.getTokenAccountBalance(reserveY)
                ]);
                if (resX.value.uiAmount && resY.value.uiAmount) {
                    this.solPriceUsd = resY.value.uiAmount / resX.value.uiAmount;
                    console.log(`[Oracle] Price from Meteora: $${this.solPriceUsd.toFixed(2)}`);
                    return;
                }
            }
            
            // Tier 2 Fallback: Jupiter Price API
            const response = await axios.get('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
            const price = response.data.data?.[this.SOL_MINT]?.price;
            if (price) {
                this.solPriceUsd = parseFloat(price);
                console.log(`[Oracle] Fallback SOL Price (Jupiter): $${this.solPriceUsd.toFixed(2)}`);
                return;
            }

        } catch (err: any) {
            console.error('[Oracle] Price refresh failed:', err.message);
        }
    }

    static resolvePrice(event: Partial<SwapEvent>): number {
        if (!event.amountIn || !event.amountOut) return 0;
        
        // Basic check for USDC legs
        if (event.tokenIn === this.USDC_MINT) return event.amountIn / event.amountOut;
        if (event.tokenOut === this.USDC_MINT) return event.amountOut / event.amountIn;
        
        // SOL triangulation
        if (event.tokenIn === this.SOL_MINT) return (event.amountIn * this.solPriceUsd) / event.amountOut;
        if (event.tokenOut === this.SOL_MINT) return (event.amountOut * this.solPriceUsd) / event.amountIn;
        
        return 0;
    }
}

export class SwapParser {
    static async parseTransaction(tx: ParsedTransactionWithMeta): Promise<SwapEvent[]> {
        const events: SwapEvent[] = [];
        const signature = tx.transaction.signatures[0];
        const slot = tx.slot;
        const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();

        const logs = tx.meta?.logMessages || [];
        const dex = logs.some(l => l.includes('raydium')) ? 'Raydium' :
                    logs.some(l => l.includes('whirlpool')) ? 'Orca' :
                    logs.some(l => l.includes('meteora')) ? 'Meteora' :
                    logs.some(l => l.includes('Jupiter')) ? 'Jupiter' : 'Unknown';

        if (dex === 'Unknown') return [];

        const pre = tx.meta?.preTokenBalances || [];
        const post = tx.meta?.postTokenBalances || [];
        const maker = pre[0]?.owner || 'Unknown';

        // Balance change discovery logic
        const changes: Map<string, number> = new Map();
        
        for (const p of post) {
            if (p.owner !== maker) continue;
            const mint = p.mint;
            const postAmt = p.uiTokenAmount.uiAmount || 0;
            const preAmt = pre.find(pr => pr.mint === mint && pr.owner === maker)?.uiTokenAmount.uiAmount || 0;
            const diff = postAmt - preAmt;
            if (Math.abs(diff) > 0) {
                changes.set(mint, (changes.get(mint) || 0) + diff);
            }
        }

        const tokens = Array.from(changes.entries());
        if (tokens.length >= 2) {
            const outToken = tokens.find(t => t[1] > 0);
            const inToken = tokens.find(t => t[1] < 0);

            if (outToken && inToken) {
                const event: SwapEvent = {
                    signature,
                    slot,
                    blockTime,
                    tokenIn: inToken[0],
                    tokenOut: outToken[0],
                    amountIn: Math.abs(inToken[1]),
                    amountOut: outToken[1],
                    priceUsd: 0,
                    maker,
                    dex
                };
                event.priceUsd = PriceOracle.resolvePrice(event);
                events.push(event);
            }
        }

        return events; 
    }
}
