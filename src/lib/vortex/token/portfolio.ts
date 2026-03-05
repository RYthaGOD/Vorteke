import { PublicKey } from '@solana/web3.js';
import { TokenInfo, fetchTokenData } from '../../dataService';
import { getResilientConnection } from '../../solana/connection';
import { fetchTokenEnhancement } from '../../monetizationService';
import { detectBundle } from '../security';
import { verifyLPBurn, getSocialSentiment } from './metrics';

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
 * Lightweight reconnaissance for search previews.
 */
export const getQuickRecon = async (tokenOrAddress: string | TokenInfo): Promise<Partial<TokenInfo>> => {
    const address = typeof tokenOrAddress === 'string' ? tokenOrAddress : tokenOrAddress.address;
    const info = typeof tokenOrAddress === 'string' ? await fetchTokenData(tokenOrAddress) : tokenOrAddress;

    const [bundle, lp, enhancement] = await Promise.all([
        detectBundle(address).catch(() => ({ isBundled: false, percentage: 0, riskLevel: 'LOW' as const })),
        verifyLPBurn(address).catch(() => 'unverified' as const),
        fetchTokenEnhancement(address).catch(() => ({ address, tier: 'Basic' as const, socials: {}, customDescription: '' }))
    ]);

    const sentiment = await getSocialSentiment(address, info.volume24h, info.priceChange24h, info.liquidityUsd).catch(() => ({ score: 50, hypeLevel: 'DORMANT' as const }));

    return {
        ...info,
        tier: (enhancement as any).tier || 'Basic',
        owner: (enhancement as any).owner,
        customDescription: (enhancement as any).customDescription,
        socials: {
            ...info.socials,
            ...((enhancement as any).socials || {})
        },
        isSafe: lp === 'verified' && bundle.percentage < 10,
        securityTags: Array.from(new Set([
            ...(info.securityTags || []),
            lp === 'verified' ? 'LP_BURNED' : 'LP_UNSECURED',
            bundle.percentage < 15 ? 'CLEAN_BUNDLE' : bundle.riskLevel === 'HIGH' ? 'HIGH_BUNDLE' : 'BNDL_DRISK'
        ])),
        advancedMetrics: {
            ...info.advancedMetrics,
            socialSentiment: sentiment
        }
    };
};

/**
 * Fetches user token holdings and resolves their metadata.
 */
export const getUserPortfolio = async (userPublicKey: string): Promise<PortfolioItem[]> => {
    if (!userPublicKey) return [];

    try {
        const pubkey = new PublicKey(userPublicKey);

        // 1. Fetch Parallel from BOTH Legacy and Token-2022 programs
        const [splAccounts, spl2022Accounts] = await Promise.all([
            getResilientConnection(c => c.getParsedTokenAccountsByOwner(pubkey, {
                programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
            })),
            getResilientConnection(c => c.getParsedTokenAccountsByOwner(pubkey, {
                programId: new PublicKey('TokenzQ9bzh9P8xN9m4K5Ad13q6pB3fbtgGfGTo2f8f')
            })).catch(() => ({ value: [] })) // Fallback for nodes that don't support it
        ]);

        const allAccounts = [...splAccounts.value, ...spl2022Accounts.value];

        // 2. Resolve Metadata in optimized parallel batches
        const holdings = await Promise.all(
            allAccounts
                .filter(acc => (acc.account.data as any).parsed.info.tokenAmount.uiAmount > 0)
                .slice(0, 40)
                .map(async (acc) => {
                    const info = (acc.account.data as any).parsed.info;
                    const mint = info.mint;
                    const balance = info.tokenAmount.uiAmount;

                    try {
                        const token = await fetchTokenData(mint);
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

        return holdings.sort((a, b) => b.valueUsd - a.valueUsd);
    } catch (e) {
        console.error("Portfolio fetch error:", e);
        return [];
    }
};
