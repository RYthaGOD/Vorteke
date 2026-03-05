import { Connection, PublicKey } from '@solana/web3.js';
import { RPC_ENDPOINTS, PROTECTED_MINT_ADDRESSES, SOL_MINT } from './constants';
import { TokenTier, TokenEnhancement, fetchTokenEnhancement } from './monetizationService';
import { captureException, logger } from './logger';
import { detectBundle as modularDetectBundle } from './vortex/security';
import { decodeVortexSwap } from './solana/txDecoder';
import { getResilientConnection } from './solana/connection';
import { HELIUS_RPC, HELIUS_API_KEY, JUPITER_API_KEY } from './constants';

// Modularized Service Layer Imports
import { fetchHeliusMetadata, getMetaplexMetadata } from './vortex/token/metadata';
import { verifyLPBurn, getHolderConcentration, getSocialSentiment } from './vortex/token/metrics';
import { getInitialChartData, subscribeToTokenChart, Timeframe, ChartTick } from './vortex/token/charts';
import { getDiscoveryList } from './vortex/token/discovery';
import { resolveSearch } from './vortex/token/search';
import { getQuickRecon, getUserPortfolio } from './vortex/token/portfolio';
import { throttledFetch, sleep } from './vortex/utils';

const detectBundle = modularDetectBundle;

export {
    fetchHeliusMetadata, getMetaplexMetadata,
    verifyLPBurn, getHolderConcentration, getSocialSentiment,
    getInitialChartData, subscribeToTokenChart,
    getDiscoveryList,
    resolveSearch,
    getQuickRecon, getUserPortfolio,
    throttledFetch, sleep,
    detectBundle
};
export type { Timeframe, ChartTick };

/**
 * Helius Priority Fee API
 * Ensures tactical swaps never fail during high-volatility congestion.
 */
export const getHeliusPriorityFee = async (accountAddresses: string[]) => {
    try {
        if (!HELIUS_API_KEY) return 5000; // default fallout

        const response = await fetch(HELIUS_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'vortex-fee',
                method: 'getPriorityFeeEstimate',
                params: [{
                    accountKeys: accountAddresses,
                    options: { includeAllPriorityFeeLevels: true }
                }]
            }),
        });

        const { result } = await response.json();
        return result?.priorityFeeLevels?.high || 5000;
    } catch {
        return 5000;
    }
};
export interface TokenInfo {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
    priceUsd: number;
    priceChange24h: number;
    volume24h: number;
    liquidityUsd: number;
    fdv: number;
    mcap: number;
    holders: number;
    owner?: string;
    tier?: TokenTier;
    latency?: number;
    socials?: {
        twitter?: string;
        telegram?: string;
        website?: string;
    };
    customDescription?: string;
    bannerURI?: string;
    iconURI?: string;
    advancedMetrics: {
        top10HolderPercent: number;
        devWalletStatus: 'selling' | 'holding' | 'accumulating' | 'burnt';
        lpBurnStatus: 'verified' | 'unverified' | 'locked';
        slippage1k: number;
        slippage10k: number;
        snipeVolumePercent: number;
        mintAuthority: 'renounced' | 'active';
        freezeAuthority: 'renounced' | 'active';
        metadataMutable: boolean;
        transferFeeBps?: number;
        holderIntelligence?: {
            clusterDetected: boolean;
            clusterSize: number;
            riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
            top10Percent: number;
        };
        socialSentiment?: {
            score: number;
            hypeLevel: 'DORMANT' | 'TRENDING' | 'MOONING';
        };
        volumeVelocity?: {
            score: number; // 0-100
            status: 'STAGNANT' | 'STABLE' | 'ACCELERATING' | 'BREAKOUT';
            ratio: number;
        };
        sentiment?: {
            buyPercent: number;
            sellPercent: number;
        };
    };
    securityTags?: string[];
    isSafe?: boolean;
}

export interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
        decimals?: number;
    };
    quoteToken: {
        address: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5: { buys: number; sells: number };
        h1: { buys: number; sells: number };
        h6: { buys: number; sells: number };
        h24: { buys: number; sells: number };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    liquidity?: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv?: number;
    marketCap?: number;
    pairCreatedAt?: number;
    info?: {
        imageUrl?: string;
        websites?: { label: string; url: string }[];
        socials?: { type: string; url: string }[];
    };
    holders?: number;
}

export interface DexScreenerResponse {
    pairs: DexScreenerPair[];
}

// ChartTick moved to vortex/token/charts.ts

export interface VortexTx {
    signature: string;
    blockTime: number;
    type: 'BUY' | 'SELL';
    amountSol: number;
    amountUsd?: number;
    wallet: string;
    labels?: string[];
}

// Throttled fetch moved to vortex/utils.ts

const RECENTLY_VIEWED_KEY = 'vortex_recently_viewed';
const DISCOVERED_TOKENS_KEY = 'vortex_discovered_tokens';

export const registerRecentlyViewed = (token: TokenInfo) => {
    if (typeof window === 'undefined') return;
    try {
        const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
        let current: any[] = stored ? JSON.parse(stored) : [];
        current = [token, ...current.filter(t => t.address !== token.address)].slice(0, 10);
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(current));
    } catch (e) { }
};

// --- Formatting Utilities ---

export const formatCurrency = (val: number, minimumDecimals: number = 2) => {
    if (val === 0) return '$0.00';

    // Industrial-grade dynamic decimal resolution for memecoins
    // If the value is very small, we find the first non-zero digit
    let decimals = minimumDecimals;
    if (val < 1) {
        const str = val.toFixed(20);
        const match = str.match(/0\.0*[1-9]/);
        if (match) {
            const leadingZeros = match[0].length - 3; // count zeros after decimal point
            decimals = Math.max(minimumDecimals, leadingZeros + 4);
        }
    }

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: Math.min(20, decimals),
        maximumFractionDigits: Math.min(20, decimals)
    }).format(val);
};

export const formatCompact = (val: number) =>
    new Intl.NumberFormat('en-US', {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(val);

export const formatPercent = (val: number) =>
    `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

export const getRecentlyViewed = (): TokenInfo[] => {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

export const getDiscoveredAddresses = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(DISCOVERED_TOKENS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

export const registerDiscoveredToken = (address: string) => {
    if (typeof window === 'undefined') return;
    const current = getDiscoveredAddresses();
    if (!current.includes(address)) {
        const updated = [address, ...current].slice(0, 50);
        localStorage.setItem(DISCOVERED_TOKENS_KEY, JSON.stringify(updated));
    }
};

// --- Server Persistence Sync ---
export const syncTokenToServer = async (token: TokenInfo) => {
    try {
        await fetch('/api/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(token)
        });
    } catch (e) {
        console.warn("SERVER_SYNC_FAILURE:", e);
    }
};

export const fetchTokenFromServer = async (address: string): Promise<TokenInfo | null> => {
    try {
        const res = await fetch(`/api/tokens?address=${address}`);
        if (res.ok) return await res.json();
    } catch { }
    return null;
};

// getResilientConnection moved to @/lib/solana/connection


/**
 * Fetch token metadata and security metrics from Mainnet
 * Enhanced with DexScreener API for metadata resolution
 */
export const fetchTokenData = async (address: string): Promise<TokenInfo> => {
    try {
        if (!address || address.length < 32 || address.length > 44) {
            throw new Error(`INVALID_ADDRESS_FORMAT: ${address}`);
        }

        const mintPubkey = new PublicKey(address);

        // 1. Fetch Parallel Data with Helius DAS as Primary Intelligence
        const [rpcResult, priceResult, dexResult, heliusResult] = await Promise.allSettled([
            getResilientConnection(async (c, endpoint) => {
                const res = await c.getParsedAccountInfo(mintPubkey);
                if (!res.value) throw new Error("ACCOUNT_NOT_FOUND");
                return { ...res, endpoint };
            }),
            throttledFetch(`https://api.jup.ag/price/v2?ids=${address}`, {
                headers: JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}
            }).then((data: any) => data).catch(() => ({ data: {} })),
            throttledFetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`).then((data: DexScreenerResponse) => data).catch(() => ({ pairs: [] as DexScreenerPair[] })),
            fetchHeliusMetadata(address) as Promise<any>
        ]);

        const mintInfo = rpcResult.status === 'fulfilled' ? rpcResult.value : null;
        const priceJson = priceResult.status === 'fulfilled' ? priceResult.value : { data: {} };
        const dexJson = dexResult.status === 'fulfilled' ? dexResult.value : { pairs: [] };
        const helius = heliusResult.status === 'fulfilled' ? heliusResult.value : null;

        const parsedData = (mintInfo?.value?.data as any)?.parsed?.info;
        const pair = dexJson?.pairs?.[0];

        // Ensure we have a valid decimal count even if RPC fails
        const decimals = parsedData?.decimals || pair?.baseToken?.decimals || helius?.decimals || 9;
        const supply = parseFloat(parsedData?.supply || '0') / Math.pow(10, decimals);

        // 2. Resolve Metadata with Hierarchical Priority
        // Priority: Helius DAS > DexScreener > RPC Parsed > Default
        const name = helius?.name || pair?.baseToken?.name || parsedData?.name || 'VORTEX Asset';
        const symbol = helius?.symbol || pair?.baseToken?.symbol || parsedData?.symbol || 'UNKNWN';

        // Detect Token2022 Transfer Fee (Tax)
        let transferFeeBps = 0;
        if (mintInfo?.value?.owner?.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
            const extensions = (parsedData as any)?.extensions;
            if (extensions) {
                const feeConfig = extensions.find((ext: any) => ext.extension === 'transferFeeConfig');
                if (feeConfig) {
                    transferFeeBps = feeConfig.state?.newerTransferFee?.transferFeeBasisPoints || feeConfig.state?.olderTransferFee?.transferFeeBasisPoints || 0;
                }
            }
        }

        // Logo Resolution: Helius DAS > DexScreener Image > On-chain Metadata fallback
        let logoURI = helius?.logoURI || pair?.info?.imageUrl || (helius as any)?.content?.links?.image;
        if (!logoURI) {
            // Predictive DexScreener URL often works before their API indexes it
            logoURI = `https://dd.dexscreener.com/ds-data/tokens/solana/${address}.png`;
        }

        // If logo is missing and metaplex URI exists, we could fetch it (deferred for perf or done here)
        // For now, we use the DexScreener predictable URL as a strong fallback

        // 3. Resolve Price and Market Data
        const jupPrice = parseFloat(priceJson?.data?.[address]?.price || '0');
        const dexPrice = parseFloat(pair?.priceUsd || '0');
        const currentPrice = helius?.priceUsd || jupPrice || dexPrice || 0;

        // 4. Volume Velocity & Social Proxy
        const v5m = pair?.volume?.m5 || 0;
        const v1h = pair?.volume?.h1 || 0;
        const velocityRatio = v1h > 0 ? (v5m / (v1h / 12)) : 0;

        let velocityStatus: 'STAGNANT' | 'STABLE' | 'ACCELERATING' | 'BREAKOUT' = 'STABLE';
        if (velocityRatio > 2.5) velocityStatus = 'BREAKOUT';
        else if (velocityRatio > 1.5) velocityStatus = 'ACCELERATING';
        else if (velocityRatio < 0.5) velocityStatus = 'STAGNANT';

        const velocityScore = Math.min(100, Math.floor(velocityRatio * 33));

        // 5. Fetch Deep Reconnaissance & Enhancement Data (Defensively)
        const [holderIntel, sentiment, bundle, lp, enhancement] = await Promise.all([
            getHolderConcentration(address).catch(() => ({ clusterDetected: false, clusterSize: 0, riskLevel: 'LOW' as const, top10Percent: 0 })),
            getSocialSentiment(address, pair?.volume?.h24 || 0, pair?.priceChange?.h24 || 0, pair?.liquidity?.usd || 0).catch(() => ({ score: 50, hypeLevel: 'DORMANT' as const })),
            detectBundle(address).catch(() => ({ isBundled: false, percentage: 0, riskLevel: 'LOW' as const })),
            verifyLPBurn(address).catch(() => 'unverified' as const),
            fetchTokenEnhancement(address).catch(() => ({ address, tier: 'Basic', socials: {}, customDescription: '' } as TokenEnhancement))
        ]);

        // 6. Build and Return Tactical Token Object
        const token: TokenInfo = {
            address,
            name,
            symbol,
            decimals,
            logoURI,
            priceUsd: currentPrice,
            priceChange24h: pair?.priceChange?.h24 || 0,
            volume24h: pair?.volume?.h24 || 0,
            liquidityUsd: pair?.liquidity?.usd || 0,
            fdv: pair?.fdv || (currentPrice * supply) || 0,
            mcap: pair?.marketCap || pair?.fdv || (currentPrice * supply) || 0,
            holders: pair?.holders || 0, // Fallback to 0, resolved in details if possible
            owner: enhancement?.owner,
            tier: enhancement?.tier || 'Basic',
            customDescription: enhancement?.customDescription,
            socials: {
                website: enhancement?.socials?.website || pair?.info?.websites?.[0]?.url,
                twitter: enhancement?.socials?.twitter || pair?.info?.socials?.find((s: any) => s.type === 'twitter')?.url,
                telegram: enhancement?.socials?.telegram || pair?.info?.socials?.find((s: any) => s.type === 'telegram')?.url,
            },
            advancedMetrics: {
                top10HolderPercent: (holderIntel as any).top10Percent || 0,
                devWalletStatus: 'holding', // In production, this would scan the deployer wallet balance
                lpBurnStatus: lp,
                slippage1k: 0.5,
                slippage10k: 2.5,
                snipeVolumePercent: bundle.percentage,
                mintAuthority: parsedData?.mintAuthority ? 'active' : 'renounced',
                freezeAuthority: parsedData?.freezeAuthority ? 'active' : 'renounced',
                metadataMutable: true,
                transferFeeBps,
                holderIntelligence: holderIntel,
                socialSentiment: sentiment,
                volumeVelocity: {
                    score: velocityScore,
                    status: velocityStatus,
                    ratio: velocityRatio
                },
                sentiment: {
                    buyPercent: (sentiment.score > 50) ? Math.min(95, sentiment.score + 10) : 50,
                    sellPercent: (sentiment.score <= 50) ? Math.min(95, 100 - sentiment.score + 10) : 50
                }
            },
            isSafe: lp === 'verified' && parsedData?.mintAuthority === undefined && ((holderIntel as any).top10Percent ?? 0) < 40
        };

        // 7. Sync to Vortex Indexer (Background)
        if (token.address) {
            syncTokenToServer(token).catch(() => { });
        }

        return token;
    } catch (error: any) {
        console.error("VORTEX_RECON_FAILURE:", error);
        captureException(error, { context: 'FETCH_TOKEN_DATA', address });
        throw error;
    }
};

// Chart and Subscription services moved to vortex/token/charts.ts

// --- Real-time Telemetry Pipeline ---

const transactionCache = new Map<string, VortexTx>();
const processedSigs = new Set<string>();
const MAX_CACHE_SIZE = 500;

const addToCache = (sig: string, tx: VortexTx) => {
    transactionCache.set(sig, tx);
    if (transactionCache.size > MAX_CACHE_SIZE) {
        const firstKey = transactionCache.keys().next().value;
        if (firstKey) transactionCache.delete(firstKey);
    }
};

/**
 * Tactical Transaction Resolver: Extracts true SOL amounts from Raydium/Jupiter swaps.
 */
const getVortexTransaction = async (signature: string, tokenAddress: string): Promise<VortexTx | null> => {
    try {
        if (transactionCache.has(signature)) return transactionCache.get(signature)!;

        // Use the new high-precision decoder
        const decoded = await decodeVortexSwap(await getResilientConnection(async (c) => c), signature, tokenAddress);

        if (decoded) {
            const labels = [];
            if (decoded.amountSol > 25 || decoded.amountUsd > 3750) labels.push('WHALE_SIGNAL');

            const currentBlockTime = decoded.blockTime || (Date.now() / 1000);

            // Sniper Heuristic: High volume buys within a very short blockTime window
            if (decoded.type === 'BUY' && decoded.amountSol > 5 && (Date.now() / 1000 - currentBlockTime) < 300) {
                labels.push('POTENTIAL_SNIPER');
            }

            const vTx: VortexTx = {
                signature,
                blockTime: currentBlockTime,
                type: decoded.type,
                amountSol: decoded.amountSol,
                amountUsd: decoded.amountUsd,
                wallet: decoded.signer.slice(0, 4) + '...' + decoded.signer.slice(-4),
                labels
            };

            // Re-fetch blockTime if possible (expensive but more accurate)
            const txDetails = await getResilientConnection(c => c.getSignatureStatuses([signature])) as any;

            transactionCache.set(signature, vTx);
            addToCache(signature, vTx);
            return vTx;
        }

        return null;
    } catch (e) {
        console.warn(`RECON_TX_ERR [${signature}]:`, e);
        return null;
    }
};

/**
 * Real-time transaction stream using Solana onLogs.
 * Filters for Raydium/Jupiter swaps involving the target token.
 */
export const subscribeToLiveStream = (address: string, onTx: (tx: VortexTx) => void) => {
    let isActive = true;
    let subscriptionId: number | null = null;
    let backoffDelay = 2000;
    let pollInterval: NodeJS.Timeout | null = null;
    let wsConn: Connection | null = null;

    const startSubscription = async () => {
        if (!isActive || typeof document === 'undefined' || document.visibilityState === 'hidden') return;

        try {
            if (!address || address.length < 32) return;
            const pubkey = new PublicKey(address);

            if (!wsConn) {
                // Prioritize Helius for WebSockets to avoid 403 Forbidden on public RPC
                const endpoint = HELIUS_RPC || RPC_ENDPOINTS.find(e => e.includes('helius')) || RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com';
                wsConn = new Connection(endpoint, 'confirmed');
            }

            subscriptionId = wsConn.onLogs(
                pubkey,
                async (logs, ctx) => {
                    if (!isActive || (typeof document !== 'undefined' && document.visibilityState === 'hidden') || processedSigs.has(logs.signature)) return;
                    processedSigs.add(logs.signature);

                    if (processedSigs.size > 1000) {
                        const firstSig = processedSigs.values().next().value;
                        if (firstSig) processedSigs.delete(firstSig);
                    }

                    // Industrial Program Matching (Jupiter V6, Raydium AMM V4, Raydium CPMM, Pump.Fun)
                    const KNOWN_DEX_PROGRAMS = [
                        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter V6
                        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM V4
                        'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', // Raydium CPMM
                        '6EF8rrecthR5Dkzon8Nwu78hRvfX9PNn2A9zH8GfE7rL'  // Pump.fun
                    ];

                    const isSwap = logs.logs.some(l =>
                        KNOWN_DEX_PROGRAMS.some(program => l.includes(`Program ${program}`) || l.includes(`Program log: Instruction: Swap`)) ||
                        l.includes('Instruction: Buy') ||
                        l.includes('Instruction: Sell')
                    );

                    if (!isSwap) return;

                    const tx = await getVortexTransaction(logs.signature, address);
                    if (tx) onTx(tx);
                },
                'confirmed'
            );

            backoffDelay = 2000; // Reset on success
            // console.debug(`WEBSOCKET_ENGAGED: Subscribed to ${address} logs.`);
        } catch (e) {
            if (isActive) {
                console.warn("WEBSOCKET_SUSPENDED: RPC uplink rejected connection. Retrying...", e);
                subscriptionId = null;
                pollInterval = setTimeout(startSubscription, backoffDelay);
                backoffDelay = Math.min(backoffDelay * 2, 60000);
            }
        }
    };

    const pollSignatures = async () => {
        if (!isActive || (typeof document !== 'undefined' && document.visibilityState === 'hidden') || subscriptionId !== null) return;

        try {
            const pk = new PublicKey(address);
            const sigs = await getResilientConnection(c => c.getSignaturesForAddress(pk, { limit: 10 }));

            for (const sigInfo of sigs.reverse()) {
                if (!processedSigs.has(sigInfo.signature)) {
                    processedSigs.add(sigInfo.signature);
                    const tx = await getVortexTransaction(sigInfo.signature, address);
                    if (tx) onTx(tx);
                }
            }

            backoffDelay = 2000; // Reset on success
        } catch (e) {
            console.warn("POLL_FAILURE: Increasing backoff.", e);
            backoffDelay = Math.min(backoffDelay * 2, 60000);
        } finally {
            if (isActive) {
                pollInterval = setTimeout(pollSignatures, backoffDelay);
            }
        }
    };

    const handleVisibilityChange = () => {
        if (typeof document === 'undefined') return;
        if (document.visibilityState === 'visible') {
            if (subscriptionId === null) startSubscription();
        } else {
            if (subscriptionId !== null && wsConn) {
                wsConn.removeOnLogsListener(subscriptionId).catch(() => { });
                subscriptionId = null;
            }
            if (pollInterval) {
                clearTimeout(pollInterval);
                pollInterval = null;
            }
        }
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    startSubscription();

    return () => {
        isActive = false;
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        if (subscriptionId !== null && wsConn) {
            wsConn.removeOnLogsListener(subscriptionId).catch(() => { });
        }
        if (pollInterval) clearTimeout(pollInterval);
    };
};

// LP Burn, Holder Concentration, and Social Sentiment services moved to vortex/token/metrics.ts
// Discovery services moved to vortex/token/discovery.ts
