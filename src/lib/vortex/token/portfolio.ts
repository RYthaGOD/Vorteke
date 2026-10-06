import { PublicKey } from '@solana/web3.js';
import { fetchTokenData } from '../../dataService';
import { getResilientConnection } from '../../solana/connection';

export interface PortfolioItem {
    address: string;
    symbol: string;
    name: string;
    logoURI?: string;
    priceUsd: number;
    balance: number;
    valueUsd: number;
    pnlPercent: number;
}

/**
 * Fetches user token holdings and resolves their metadata.
 * Tier-based scaling: Basic users see 10, Elite users see 40.
 */
export const getUserPortfolio = async (userPublicKey: string, isElite: boolean = false): Promise<PortfolioItem[]> => {
    if (!userPublicKey) return [];

    try {
        const pubkey = new PublicKey(userPublicKey);

        // 1. Fetch Parallel from BOTH Legacy and Token-2022 programs
        const [splAccounts, spl2022Accounts] = await Promise.all([
            getResilientConnection(c => c.getParsedTokenAccountsByOwner(pubkey, {
                programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
            })),
            getResilientConnection(c => c.getParsedTokenAccountsByOwner(pubkey, {
                // FIX: Corrected Token-2022 program ID (was truncated/incorrect)
                programId: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')
            })).catch(() => ({ value: [] })) // Fallback for nodes that don't support it
        ]);

        const allAccounts = [...splAccounts.value, ...spl2022Accounts.value];
        const limit = isElite ? 40 : 10;

        // 2. Process ALL valid accounts to extract metadata and value
        const allHoldings = await Promise.all(
            allAccounts
                .filter(acc => (acc.account.data as any).parsed.info.tokenAmount.uiAmount > 0)
                .map(async (acc) => {
                    const info = (acc.account.data as any).parsed.info;
                    const mint = info.mint;
                    const balance = info.tokenAmount.uiAmount;

                    try {
                        const token = await fetchTokenData(mint);
                        if (!token) throw new Error("TOKEN_NOT_FOUND");

                        return {
                            address: mint,
                            symbol: token.symbol,
                            name: token.name,
                            logoURI: token.logoURI,
                            priceUsd: token.priceUsd,
                            balance,
                            valueUsd: balance * token.priceUsd,
                            pnlPercent: token.priceChange24h
                        };
                    } catch (err) {
                        return {
                            address: mint,
                            symbol: 'SOL_ASSET',
                            name: 'Unknown Token',
                            priceUsd: 0,
                            balance,
                            valueUsd: 0,
                            pnlPercent: 0
                        };
                    }
                })
        );

        // 3. Sort by total USD value, then apply the limit slice
        return allHoldings.sort((a, b) => b.valueUsd - a.valueUsd).slice(0, limit);
    } catch (e) {
        console.error("Portfolio fetch error:", e);
        throw new Error('Could not load wallet holdings. Please retry.');
    }
};
