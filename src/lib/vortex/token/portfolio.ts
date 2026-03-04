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
        const tokenAccounts = await getResilientConnection(c => c.getParsedTokenAccountsByOwner(pubkey, {
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        }));

        const holdings = await Promise.all(
            tokenAccounts.value
                .filter((acc: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }) => acc.account.data.parsed.info.tokenAmount.uiAmount > 0)
                .slice(0, 50)
                .map(async (acc: { account: { data: { parsed: { info: { mint: string, tokenAmount: { uiAmount: number } } } } } }) => {
                    const mint = acc.account.data.parsed.info.mint;
                    const balance = acc.account.data.parsed.info.tokenAmount.uiAmount;

                    try {
                        const info = await fetchTokenData(mint);
                        return {
                            address: mint,
                            symbol: info.symbol,
                            name: info.name,
                            logoURI: info.logoURI,
                            priceUsd: info.priceUsd,
                            balance,
                            valueUsd: balance * info.priceUsd,
                            pnlPercent: info.priceChange24h
                        };
                    } catch {
                        return {
                            address: mint,
                            symbol: 'UNKNOWN',
                            name: 'Unknown Asset',
                            logoURI: undefined,
                            priceUsd: 0,
                            balance,
                            valueUsd: 0,
                            pnlPercent: 0
                        };
                    }
                })
        );

        return holdings.sort((a: any, b: any) => b.valueUsd - a.valueUsd);
    } catch (e) {
        console.error("Portfolio fetch error:", e);
        return [];
    }
};
