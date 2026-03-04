import { PublicKey } from '@solana/web3.js';
import { TokenInfo, fetchTokenData, registerDiscoveredToken, fetchTokenFromServer, DexScreenerResponse, DexScreenerPair } from '../../dataService';
import { TokenEnhancement, fetchTokenEnhancement } from '../../monetizationService';
import { throttledFetch } from '../utils';
import { detectBundle } from '../security';
import { verifyLPBurn } from './metrics';

/**
 * Resolves a search query into potential token matches.
 * Handles addresses, symbols, and project names.
 */
export const resolveSearch = async (query: string): Promise<TokenInfo[]> => {
    if (!query || query.length < 2) return [];

    try {
        const queryLower = query.toLowerCase();

        // 0. Check Server Index first
        if (query.length >= 32) {
            const cached = await fetchTokenFromServer(query);
            if (cached) return [cached];
        }

        // 1. If it looks like a mint address, force an on-chain resolution first
        const isAddress = query.length >= 32 && query.length <= 44 && !query.includes(' ') && !query.includes('.');
        if (isAddress) {
            try {
                // Ensure it's valid Base58 before burning RPC credits
                new PublicKey(query);
                const token = await fetchTokenData(query);
                if (token) {
                    await detectBundle(token.address).catch(() => { });
                    await verifyLPBurn(token.address).catch(() => { });
                    registerDiscoveredToken(token.address);
                    return [token];
                }
            } catch (e) {
                // Not a valid address or not found on-chain, continue to search
            }
        }

        // 2. DexScreener Search API
        const searchRes = await throttledFetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`) as DexScreenerResponse;
        const pairs = (searchRes.pairs || []).filter((p: DexScreenerPair) => p.chainId === 'solana');

        // 3. Batch resolve enhancements
        const uniqueAddresses = Array.from(new Set(pairs.map((p: any) => p.baseToken?.address))).filter((addr): addr is string => !!addr);
        const enhancementMap = new Map<string, TokenEnhancement>();

        await Promise.all(uniqueAddresses.slice(0, 10).map(async (addr: string) => {
            try {
                const enh = await fetchTokenEnhancement(addr);
                if (enh) enhancementMap.set(addr, enh);
            } catch { }
        }));

        return pairs.slice(0, 10).map((pair: any) => {
            const address = pair.baseToken.address;
            const enhancement = enhancementMap.get(address);

            const token: TokenInfo = {
                address,
                name: pair.baseToken.name,
                symbol: pair.baseToken.symbol,
                decimals: pair.baseToken.decimals || 9,
                logoURI: pair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${address}.png`,
                priceUsd: parseFloat(pair.priceUsd || '0'),
                priceChange24h: pair.priceChange?.h24 || 0,
                volume24h: pair.volume?.h24 || 0,
                liquidityUsd: pair.liquidity?.usd || 0,
                fdv: pair.fdv || 0,
                mcap: pair.fdv || 0,
                holders: 0,
                tier: enhancement?.tier || 'Basic',
                owner: enhancement?.owner,
                customDescription: enhancement?.customDescription,
                socials: {
                    website: enhancement?.socials?.website || pair.info?.websites?.[0]?.url,
                    twitter: enhancement?.socials?.twitter || pair.info?.socials?.find((s: any) => s.type === 'twitter')?.url,
                    telegram: enhancement?.socials?.telegram || pair.info?.socials?.find((s: any) => s.type === 'telegram')?.url,
                },
                advancedMetrics: {
                    top10HolderPercent: 0,
                    devWalletStatus: 'holding',
                    lpBurnStatus: 'unverified',
                    slippage1k: 0.5,
                    slippage10k: 2.5,
                    snipeVolumePercent: 0,
                    mintAuthority: 'renounced',
                    freezeAuthority: 'renounced',
                    metadataMutable: true,
                    holderIntelligence: {
                        clusterDetected: false,
                        clusterSize: 0,
                        riskLevel: 'LOW',
                        top10Percent: 0
                    },
                    sentiment: {
                        buyPercent: 50,
                        sellPercent: 50
                    }
                },
                securityTags: ['PENDING_RECON']
            };

            registerDiscoveredToken(address);
            return token;
        });
    } catch (e) {
        console.error("Search resolution error:", e);
        return [];
    }
};
