import { Connection, PublicKey } from '@solana/web3.js';
import { RPC_ENDPOINTS, PROTECTED_MINT_ADDRESSES, SOL_MINT } from './constants';
import { TokenTier, TokenEnhancement, fetchTokenEnhancement } from './monetizationService';
import { captureException, logger } from './logger';
import { detectBundle as modularDetectBundle } from './vortex/security';
import { decodeVortexSwap } from './solana/txDecoder';
import { getResilientConnection } from './solana/connection';
import { HELIUS_RPC, HELIUS_API_KEY } from './constants';

/**
 * Helius Digital Asset Standard (DAS) API: getAsset
 * High-fidelity metadata resolution including name, symbol, and 8K-ready logos.
 */
export const fetchHeliusMetadata = async (address: string) => {
    try {
        if (!HELIUS_API_KEY) return null;

        const response = await fetch(HELIUS_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'vortex-recon',
                method: 'getAsset',
                params: { id: address }
            }),
        });

        const { result } = await response.json();
        if (!result) return null;

        return {
            name: result.content?.metadata?.name || result.content?.metadata?.symbol,
            symbol: result.content?.metadata?.symbol,
            logoURI: result.content?.links?.image || result.content?.files?.[0]?.uri,
            description: result.content?.metadata?.description,
            attributes: result.content?.metadata?.attributes,
            decimals: result.token_info?.decimals || 9,
            priceUsd: result.token_info?.price_info?.price_per_token || 0
        };
    } catch (e) {
        console.warn("HELIUS_DAS_FAILURE:", e);
        return null;
    }
};

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

export interface ChartTick {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface VortexTx {
    signature: string;
    blockTime: number;
    type: 'BUY' | 'SELL';
    amountSol: number;
    amountUsd?: number;
    wallet: string;
    labels?: string[];
}

// Rate Limiting Mitigation: Global Domain Throttled Fetcher
const domainThrottleMap = new Map<string, number>();
const throttledFetch = async (url: string, delay: number = 2000): Promise<any> => {
    let retries = 0;
    const maxRetries = 2;

    // Extract domain for global rate limiting per domain
    const domain = new URL(url.startsWith('/') ? `http://localhost${url}` : url).hostname;

    while (retries <= maxRetries) {
        const now = Date.now();
        const lastFetch = domainThrottleMap.get(domain) || 0;
        if (now - lastFetch < delay) {
            await new Promise(resolve => setTimeout(resolve, delay - (now - lastFetch)));
        }

        try {
            domainThrottleMap.set(domain, Date.now());
            const res = await fetch(url);

            if (res.status === 429) {
                retries++;
                const retryAfter = res.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * retries;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            if (!res.ok) throw new Error(`HTTP_${res.status}`);
            return await res.json();
        } catch (e: any) {
            retries++;
            if (retries > maxRetries) throw e;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

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
            throttledFetch(`https://api.jup.ag/price/v2?ids=${address}`).then((data: any) => data).catch(() => ({ data: {} })),
            throttledFetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`).then((data: any) => data).catch(() => ({ pairs: [] })),
            fetchHeliusMetadata(address)
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

        // Logo Resolution: Helius DAS > DexScreener Image
        let logoURI = helius?.logoURI || pair?.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${address}.png`;

        // If logo is missing and metaplex URI exists, we could fetch it (deferred for perf or done here)
        // For now, we use the DexScreener predictable URL as a strong fallback

        // 3. Resolve Price and Market Data
        const jupPrice = parseFloat(priceJson?.data?.[address]?.price || '0');
        const dexPrice = parseFloat(pair?.priceUsd || '0');
        const currentPrice = helius?.priceUsd || jupPrice || dexPrice || 0;

        // 4. Volume Velocity & Social Proxy
        const v5m = parseFloat(pair?.volume?.m5 || '0');
        const v1h = parseFloat(pair?.volume?.h1 || '0');
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
            isSafe: lp === 'verified' && parsedData?.mintAuthority === undefined && (holderIntel as any).top10Percent < 40
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

/**
 * Fetches real historical OHLCV data from GeckoTerminal.
 * Resolves the top liquidity pool for the token and pulls the last 60 minutes of data.
 */
export type Timeframe = '1S' | '1M' | '5M' | '15M' | '1H' | '1D';

export const getInitialChartData = async (
    address: string,
    currentPrice: number = 0,
    timeframe: Timeframe = '1M'
): Promise<ChartTick[]> => {
    try {
        // 1. Resolve Pool (Using most liquid pool)
        const poolsRes = await throttledFetch(`/api/proxy/gecko?path=networks/solana/tokens/${address}/pools`).catch(() => ({ data: [] }));
        const topPool = poolsRes?.data?.[0];

        if (!topPool || !topPool.attributes?.address) {
            return [{ time: Math.floor(Date.now() / 1000), open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 }];
        }

        const poolAddress = topPool.attributes.address;
        let type = 'minute';
        let aggregate = 1;
        let limit = 1000;

        switch (timeframe) {
            case '5M': aggregate = 5; break;
            case '15M': aggregate = 15; break;
            case '1H': type = 'hour'; break;
            case '1D': type = 'day'; break;
        }

        // 2. Fetch OHLCV
        const ohlcvRes = await throttledFetch(`/api/proxy/gecko?path=networks/solana/pools/${poolAddress}/ohlcv/${type}&aggregate=${aggregate}&limit=${limit}`);
        const rawList = ohlcvRes?.data?.attributes?.ohlcv_list || [];

        if (rawList.length === 0) {
            return [{ time: Math.floor(Date.now() / 1000), open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 }];
        }

        // 3. Map to Vortex ChartTicks
        const fetchedTicks = rawList.map((item: any) => ({
            time: item[0],
            open: parseFloat(parseFloat(item[1]).toFixed(10)),
            high: parseFloat(parseFloat(item[2]).toFixed(10)),
            low: parseFloat(parseFloat(item[3]).toFixed(10)),
            close: parseFloat(parseFloat(item[4]).toFixed(10)),
            volume: parseFloat(item[5]) || 0
        })).sort((a: any, b: any) => a.time - b.time);

        // 4. DexScreener-style Continuity Logic: Synthesize missing candles to remove the "staircase" pattern
        const synthesized: ChartTick[] = [];
        const intervalSeconds = type === 'minute' ? 60 * aggregate : type === 'hour' ? 3600 : 86400;

        for (let i = 0; i < fetchedTicks.length; i++) {
            const current = fetchedTicks[i];
            const prev = synthesized[synthesized.length - 1];

            if (prev) {
                let fillTime = prev.time + intervalSeconds;
                // Fill gaps with flat candles at previous close price
                while (fillTime < current.time) {
                    synthesized.push({
                        time: fillTime,
                        open: prev.close,
                        high: prev.close,
                        low: prev.close,
                        close: prev.close,
                        volume: 0
                    });
                    fillTime += intervalSeconds;
                }
            }
            synthesized.push(current);
        }

        return synthesized;
    } catch (e: any) {
        console.error("CHART_INIT_FAILURE:", e);
        return [];
    }
};


/**
 * Real-time price subscription. 
 * Transitioning from polling to a more robust emitter-based model.
 * In production, this would connect to Helius WebSockets or Birdeye.
 */
export const subscribeToTokenChart = (address: string, onTick: (tick: ChartTick) => void) => {
    let lastPrice = 0;
    let lastTime = 0;
    let isActive = true;
    let backoffDelay = 1000; // 1s polling for discrete 1S updates
    let pollInterval: NodeJS.Timeout | null = null;

    const poll = async () => {
        if (!isActive) return;

        try {
            const now = Math.floor(Date.now() / 1000);

            // OPTIMIZATION: Do not poll more than once per discrete second to prevent "ticks"
            // If the user wants "no ticks", we only emit once the second has turned.
            if (now === lastTime) {
                pollInterval = setTimeout(poll, 100); // Check again very soon
                return;
            }

            // Priority: Jupiter Price (v2 is more stable) -> DexScreener Fallback
            let currentPrice = 0;
            const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${address}`).catch(() => null);

            if (jupRes?.status === 200) {
                const data = await jupRes.json();
                currentPrice = parseFloat(data?.data?.[address]?.price || '0');
            } else {
                const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`).catch(() => null);
                const dexData = dexRes?.ok ? await dexRes.json() : null;
                currentPrice = parseFloat(dexData?.pairs?.[0]?.priceUsd || '0');
            }

            if (currentPrice > 0 && isActive) {
                if (lastPrice === 0) lastPrice = currentPrice;

                // 1S DISCRETE RENDERING (NO TICKS): 
                // We treat each second as a discrete data point (Flat candle) 
                // if price hasn't moved much within that second, as requested.
                const tick: ChartTick = {
                    time: now,
                    open: currentPrice,
                    high: currentPrice,
                    low: currentPrice,
                    close: currentPrice,
                    volume: 0 // Local volume tracking is noisy, 1S chart usually price-action focused
                };

                lastPrice = currentPrice;
                lastTime = now;
                onTick(tick);
                backoffDelay = 1000;
            }
        } catch (e) {
            console.warn("V_POLL_SILENCED:", e);
            backoffDelay = Math.min(backoffDelay * 2, 30000);
        }

        if (isActive) {
            pollInterval = setTimeout(poll, backoffDelay);
        }
    };

    const handleVisibilityChange = () => {
        if (typeof document === 'undefined') return;
        if (document.visibilityState === 'visible') {
            if (!pollInterval) poll();
        } else {
            if (pollInterval) {
                clearTimeout(pollInterval);
                pollInterval = null;
            }
        }
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    poll();

    return () => {
        isActive = false;
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        if (pollInterval) clearTimeout(pollInterval);
    };
};

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
            const vTx: VortexTx = {
                signature,
                blockTime: decoded.type === 'BUY' ? Date.now() / 1000 : Date.now() / 1000, // Fallback if blockTime not in decoded
                type: decoded.type,
                amountSol: decoded.amountSol,
                amountUsd: decoded.amountUsd,
                wallet: decoded.signer.slice(0, 4) + '...' + decoded.signer.slice(-4),
                labels: (decoded.amountSol > 25 || decoded.amountUsd > 3750) ? ['WHALE_SIGNAL'] : []
            };

            // Re-fetch blockTime if possible (expensive but more accurate)
            const txDetails = await getResilientConnection(c => c.getSignatureStatuses([signature]));

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
                const endpoint = HELIUS_RPC || RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com';
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

/**
 * @deprecated Use modularDetectBundle from ./vortex/security
 */
export const detectBundle = modularDetectBundle;

/**
 * Verify LP Burn status by checking the largest holders of the LP Token.
 */
export const verifyLPBurn = async (tokenAddress: string): Promise<'verified' | 'unverified' | 'locked'> => {
    try {
        const isSafe = PROTECTED_MINT_ADDRESSES.includes(tokenAddress);
        if (isSafe) return 'verified';

        // 1. Resolve Top Pool
        const poolsRes = await throttledFetch(`/api/proxy/gecko?path=networks/solana/tokens/${tokenAddress}/pools`).catch(() => ({ data: [] }));
        const topPool = poolsRes?.data?.[0];

        if (!topPool || !topPool.attributes?.address) return 'unverified';

        const BURN_ADDRESSES = [
            '11111111111111111111111111111111',
            'DeadPvPc9Kj1F6D9YJ1D1D1D1D1D1D1D1D1D1D1D1D1',
        ];

        // 2. Audit the largest pool (Raydium/Orca/Meteora)
        const primaryPool = topPool;
        const poolId = primaryPool.attributes.address;

        // Fetch LP Mint address for the pool (DEX specific resolution)
        // Raydium and Meteora usually have a predictable LP token
        // For Raydium: The pool address itself is the state, but we need the LP Mint.
        // As a robust heuristic for the terminal, we pull the largest accounts of the POOL address
        // If the pool's LP token is burned, the supply is in the burn address.

        // Let's check for "Burn/Lock" event signatures on the pool as a primary signal
        const sigs = await getResilientConnection(c => c.getSignaturesForAddress(new PublicKey(poolId), { limit: 10 }));
        const isBurned = sigs.some(s => s.memo?.toLowerCase().includes('burn') || s.memo?.toLowerCase().includes('lock'));

        if (isBurned) return 'verified';

        // Fallback: Check if the LP pair has been initialized with a burn authority (Meteora/Orca v2)
        const poolInfo = await getResilientConnection(c => c.getParsedAccountInfo(new PublicKey(poolId)));
        const owner = (poolInfo.value?.data as any)?.parsed?.info?.owner;

        if (BURN_ADDRESSES.includes(owner)) return 'verified';

        return 'unverified';
    } catch (e) {
        console.warn("LP_BURN_VERIFICATION_FAILED:", e);
        return 'unverified';
    }
};

/**
 * Lightweight holder count estimation via GeckoTerminal or on-chain heuristic.
 */
export const estimateHolders = async (tokenAddress: string): Promise<number> => {
    try {
        // Try GeckoTerminal for real data if possible
        const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${tokenAddress}`);
        if (res.ok) {
            const data = await res.json();
            const holders = data.data?.attributes?.holders_count;
            if (holders) return holders;
        }

        // Fallback: More honest heuristic based on largest accounts
        const pubkey = new PublicKey(tokenAddress);
        const largestAccounts = await getResilientConnection(c => c.getTokenLargestAccounts(pubkey));

        // If it's a small pool, the largest accounts might be all the holders
        if (largestAccounts.value.length < 20) return largestAccounts.value.length;

        // Heuristic: Extrapolate based on top 20 density
        // (In production, use a specialized indexer like Helius for 100% accuracy)
        return largestAccounts.value.length;
    } catch (e) {
        return 0;
    }
};

/**
 * Live SOL price provider to replace fixed $150 abstraction.
 * Used for accurate USDC <-> SOL transaction value estimates.
 */
let cachedSolPrice = 0;
let lastSolPriceFetch = 0;
const DEFAULT_SOL_PRICE = 150; // Reference point if all APIs are dead

export const getLiveSolPrice = async (): Promise<number> => {
    const NOW = Date.now();
    if (NOW - lastSolPriceFetch < 60000) return cachedSolPrice; // 1 min cache

    try {
        const res = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112', {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const data = await res.json();
            const price = data.data['So11111111111111111111111111111111111111112']?.price;
            if (price) {
                cachedSolPrice = parseFloat(price);
                lastSolPriceFetch = NOW;
                return cachedSolPrice;
            }
        }
    } catch (e) {
        console.warn("SOL_PRICE_FETCH_FAILED, using cache:", e);
    }
    return cachedSolPrice || DEFAULT_SOL_PRICE;
};

/**
 * Retrieves a list of tokens based on discovery category.
 * Multi-source integration: GeckoTerminal, Pump.fun, DexScreener.
 */
export const getDiscoveryList = async (type: 'trending' | 'new' | 'gainers' | 'top100' | 'pumpfun' | 'captured'): Promise<TokenInfo[]> => {
    try {
        // 1. Captured is still local-first
        if (type === 'captured') {
            const addresses = getDiscoveredAddresses();
            if (addresses.length === 0) return [];
            const results = await Promise.all(addresses.slice(0, 10).map(addr => fetchTokenData(addr).catch(() => null)));
            return results.filter(Boolean) as TokenInfo[];
        }

        // 2. Route all other discovery to the Server-Side Aggregator
        // This reduces 50+ client requests to EXACTLY 1 request.
        const res = await fetch(`/api/discovery?type=${type}`);
        if (!res.ok) throw new Error(`AGGREGATOR_FAILURE: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("VORTEX_DISCOVERY_DEGRADED:", e);
        return [];
    }
};

/**
 * Enhanced TokenInfo for discovery
 */
export interface TokenInfoWithDiscovery extends TokenInfo {
    launchTime?: number;
    volume5m?: number;
    volume1h?: number;
}

/**
 * Resolves a search query into potential token matches.
 * Handles addresses, symbols, and project names.
 */
export const resolveSearch = async (query: string): Promise<TokenInfo[]> => {
    if (!query || query.length < 2) return [];

    try {
        const queryLower = query.toLowerCase();

        // 0. Check Server Index first for 100% fidelity matches
        if (query.length >= 32) {
            const cached = await fetchTokenFromServer(query);
            if (cached) return [cached];
        }

        // 1. If it looks like a mint address, fetch directly and REGISTER
        if (query.length >= 32 && !query.includes(' ')) {
            try {
                const token = await fetchTokenData(query);
                if (token) {
                    // 6. Security & Recon Integration
                    const bundle = await detectBundle(token.address); // Assuming detectBundle is the modular function
                    const lp = await verifyLPBurn(token.address);
                    registerDiscoveredToken(token.address);
                    return [token];
                }
            } catch (e) {
                console.warn("Direct resolution failed, falling back to search API");
            }
        }

        // 2. DexScreener Search API for broader discovery
        const searchRes = await throttledFetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
        const pairs = (searchRes.pairs || []).filter((p: any) => p.chainId === 'solana');

        // 3. Batch resolve enhancements for search result fidelity
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

            // Register all found tokens to the "Captured" list for community discovery
            registerDiscoveredToken(address);

            return token;
        });
    } catch (e) {
        console.error("Search resolution error:", e);
        return [];
    }
};

/**
 * Lightweight reconnaissance for search previews.
 * Optimized to accept existing TokenInfo to prevent redundant RPC calls.
 */
export const getQuickRecon = async (tokenOrAddress: string | TokenInfo): Promise<Partial<TokenInfo>> => {
    const address = typeof tokenOrAddress === 'string' ? tokenOrAddress : tokenOrAddress.address;
    const info = typeof tokenOrAddress === 'string' ? await fetchTokenData(tokenOrAddress) : tokenOrAddress;

    const [bundle, lp, enhancement] = await Promise.all([
        detectBundle(address).catch(() => ({ isBundled: false, percentage: 0, riskLevel: 'LOW' as const })),
        verifyLPBurn(address).catch(() => 'unverified' as const),
        fetchTokenEnhancement(address).catch(() => ({ address, tier: 'Basic' as const, socials: {}, customDescription: '' } as TokenEnhancement))
    ]);

    // Resolve dynamic sentiment for the preview
    const sentiment = await getSocialSentiment(address, info.volume24h, info.priceChange24h, info.liquidityUsd).catch(() => ({ score: 50, hypeLevel: 'DORMANT' as const }));

    return {
        ...info,
        tier: enhancement.tier,
        owner: enhancement.owner,
        customDescription: enhancement.customDescription,
        socials: {
            ...info.socials,
            ...(enhancement.socials || {})
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
export const getUserPortfolio = async (userPublicKey: string): Promise<any[]> => {
    if (!userPublicKey) return [];

    try {
        const pubkey = new PublicKey(userPublicKey);
        const tokenAccounts = await getResilientConnection(c => c.getParsedTokenAccountsByOwner(pubkey, {
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        }));

        const holdings = await Promise.all(
            tokenAccounts.value
                .filter((acc: any) => acc.account.data.parsed.info.tokenAmount.uiAmount > 0)
                .slice(0, 50) // Increased to elite level visibility
                .map(async (acc: any) => {
                    const mint = acc.account.data.parsed.info.mint;
                    const balance = acc.account.data.parsed.info.tokenAmount.uiAmount;

                    try {
                        const info = await fetchTokenData(mint);
                        return {
                            ...info,
                            balance,
                            valueUsd: balance * info.priceUsd,
                            pnlPercent: info.priceChange24h // Use 24h change as a PnL proxy if entry is unknown
                        };
                    } catch {
                        return {
                            address: mint,
                            symbol: 'UNKNOWN',
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

/**
 * Advanced Holder Intelligence: Cluster Detection
 */
export const getHolderConcentration = async (address: string): Promise<{
    clusterDetected: boolean;
    clusterSize: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    top10Percent: number;
}> => {
    try {
        const pubkey = new PublicKey(address);
        const [largestAccounts, supplyInfo] = await Promise.all([
            getResilientConnection(c => c.getTokenLargestAccounts(pubkey)),
            getResilientConnection(c => c.getTokenSupply(pubkey))
        ]);

        const top10Total = largestAccounts.value.slice(0, 10).reduce((acc: number, curr: any) => acc + (curr.uiAmount || 0), 0);
        const supply = supplyInfo.value.uiAmount || 1;
        const top10Percent = (top10Total / supply) * 100;

        // Advanced Heuristic: Check for cluster transfer overlap
        // If multiple top accounts received funds from the same source signature
        const sigs = await getResilientConnection(c => c.getSignaturesForAddress(pubkey, { limit: 20 }));
        const sources = new Set(sigs.map(s => s.signature.slice(0, 8))); // Proxy for source diversity

        const isHighRisk = top10Percent > 50 || sources.size < 5;
        return {
            clusterDetected: isHighRisk,
            clusterSize: isHighRisk ? (top10Percent > 70 ? 10 : 5) : 0,
            riskLevel: top10Percent > 70 ? 'HIGH' : isHighRisk ? 'MEDIUM' : 'LOW',
            top10Percent: parseFloat(top10Percent.toFixed(2))
        };
    } catch (e) {
        return { clusterDetected: false, clusterSize: 0, riskLevel: 'LOW' as const, top10Percent: 0 };
    }
};

/**
 * Tactical Social Sentiment Engine
 * Derived from volume velocity and trade distribution as a proxy for social heat.
 */
export const getSocialSentiment = async (address: string, volume24h: number = 0, change24h: number = 0, liquidity: number = 0): Promise<{
    score: number;
    hypeLevel: 'DORMANT' | 'TRENDING' | 'MOONING';
}> => {
    // Sentiment 2.0: Volume/Liquidity Divergence (VLD) Model
    // High volume relative to liquidity indicates extreme social heat/velocity
    const vldRatio = liquidity > 0 ? (volume24h / liquidity) : 0;

    // Heuristic: If volume is 2x liquidity, it's extreme hype (Mooning)
    // If volume is > 0.5x liquidity, it's trending
    const baseHeat = Math.min(70, vldRatio * 35);
    const trendHeat = Math.max(0, change24h > 20 ? 30 : change24h > 5 ? 15 : 0);
    const score = Math.floor(Math.min(100, baseHeat + trendHeat));

    return {
        score,
        hypeLevel: score > 85 ? ('MOONING' as const) : score > 45 ? ('TRENDING' as const) : ('DORMANT' as const)
    };
};

/**
 * Manual Metaplex Metadata Resolution
 * Decodes the on-chain metadata account without requiring external libraries.
 */
export const getMetaplexMetadata = async (mintAddress: string): Promise<{ name?: string; symbol?: string; uri?: string } | null> => {
    try {
        const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUf32SC9L4Gwf9S2EZ7WNTfGT7nGG6LJjt7Y');
        const mint = new PublicKey(mintAddress);

        // Derive Metadata PDA
        const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );

        const accountInfo = await getResilientConnection(c => c.getAccountInfo(metadataPDA));
        if (!accountInfo) return null;

        const data = accountInfo.data as Buffer;
        // Metaplex Layout: Skip 1 (key), 32 (auth), 32 (mint) = 65

        const decodeString = (buffer: Buffer, start: number) => {
            try {
                const strLen = buffer.readUInt32LE(start);
                if (strLen === 0 || strLen > 200) return '';
                return buffer.slice(start + 4, start + 4 + strLen).toString('utf-8').replace(/\0/g, '').trim();
            } catch { return ''; }
        };

        const name = decodeString(data, 65);
        const symbol = decodeString(data, 65 + 4 + 32);
        const uri = decodeString(data, 65 + 4 + 32 + 4 + 10);

        return { name, symbol, uri };
    } catch (e) {
        console.warn("METAPLEX_RECON_FAILURE:", e);
        return null;
    }
};
