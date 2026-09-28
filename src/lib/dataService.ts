import { Connection, PublicKey } from '@solana/web3.js';
import { RPC_ENDPOINTS, PROTECTED_MINT_ADDRESSES, SOL_MINT } from './constants';
import { TokenTier, TokenEnhancement, fetchTokenEnhancement, verifyEliteAccess } from './monetizationService';
import { captureException, logger } from './logger';
import { detectBundle as modularDetectBundle, detectCreatorCluster, traceFundingOrigins } from './vortex/security';
import { decodeVortexSwap } from './solana/txDecoder';
import { getResilientConnection } from './solana/connection';
import { HELIUS_RPC, HELIUS_API_KEY, JUPITER_API_KEY } from './constants';

// Modularized Service Layer Imports
import { fetchHeliusMetadata, getMetaplexMetadata } from './vortex/token/metadata';
import { verifyLPBurn, getHolderConcentration, getMarketVelocity } from './vortex/token/metrics';
import { getInitialChartData, subscribeToTokenChart, Timeframe, ChartTick } from './vortex/token/charts';
export type { Timeframe, ChartTick };
import { getDiscoveryList } from './vortex/token/discovery';
import { resolveSearch } from './vortex/token/search';
import { getQuickRecon, getUserPortfolio } from './vortex/token/portfolio';
import { throttledFetch, sleep } from './vortex/utils';
import { aetherClient } from './vortex/aetherClient';

// Newly extracted modules
import { TokenInfo } from './vortex/token/types';
import { formatCurrency, formatCompact, formatPercent } from './vortex/token/formatting';
import { registerRecentlyViewed, getRecentlyViewed, getDiscoveredAddresses, registerDiscoveredToken } from './vortex/token/storage';
export type { TokenInfo };

const detectBundle = modularDetectBundle;

export {
    fetchHeliusMetadata, getMetaplexMetadata,
    verifyLPBurn, getHolderConcentration, getMarketVelocity,
    getInitialChartData, subscribeToTokenChart,
    getDiscoveryList,
    resolveSearch,
    getQuickRecon, getUserPortfolio,
    throttledFetch, sleep,
    detectBundle,
    formatCurrency, formatCompact, formatPercent,
    registerRecentlyViewed, getRecentlyViewed, getDiscoveredAddresses, registerDiscoveredToken
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
// TokenInfo interface is imported from './vortex/token/types'

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
    tokenAmount?: number;
    priceUsd?: number;
    wallet: string;
    labels?: string[];
}

// Throttled fetch moved to vortex/utils.ts

// Storage and Formatting utilities are imported from './vortex/token/storage' and './vortex/token/formatting'

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
export const fetchTokenData = async (address: string, viewerWallet?: string): Promise<TokenInfo | null> => {
    try {
        let isElite = viewerWallet ? await verifyEliteAccess(viewerWallet) : false;
        if (!address || address.length < 32 || address.length > 44) {
            throw new Error(`INVALID_ADDRESS_FORMAT: ${address}`);
        }

        const mintPubkey = new PublicKey(address);

        // NATIVE_SOL_PROTECTION: DexScreener misidentifies So1111... as "FOGO". 
        // We MUST intercept and override with absolute truth (Case-Insensitive for UI safety).
        const isSol = address.toLowerCase() === 'So11111111111111111111111111111111111111112'.toLowerCase();

        // 1. Fetch Parallel Data (Initial Batch: Oracle Consensus + Static Intel)
        const batchResults = await Promise.allSettled([
            getResilientConnection(async (c, endpoint) => {
                try {
                    const res = await c.getParsedAccountInfo(mintPubkey);
                    if (!res.value) return { value: null, endpoint };
                    return { ...res, endpoint };
                } catch (e) {
                    return { value: null, endpoint };
                }
            }),
            fetchHeliusMetadata(address) as Promise<any>,
            throttledFetch(`/api/proxy/jup-price?ids=${address}`).catch(() => null), // V2 Migration
            getHolderConcentration(address).catch(() => ({ clusterDetected: false, clusterSize: 0, riskLevel: 'LOW' as const, top10Percent: 0 })),
            detectBundle(address).catch(() => ({ isBundled: false, percentage: 0, riskLevel: 'LOW' as const })),
            verifyLPBurn(address).catch(() => 'unverified' as const),
            fetchTokenEnhancement(address).catch(() => ({ address, tier: 'Basic', socials: {}, customDescription: '' } as TokenEnhancement)),
            aetherClient.searchTokens(address).catch(() => []),
            throttledFetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${address}`).catch(() => null)
        ]);

        const rpcResult = batchResults[0] as PromiseSettledResult<any>;
        const heliusResult = batchResults[1] as PromiseSettledResult<any>;
        const jupResult = batchResults[2] as PromiseSettledResult<any>;
        const holderIntel = batchResults[3] as PromiseSettledResult<any>;
        const bundle = batchResults[4] as PromiseSettledResult<any>;
        const lp = batchResults[5] as PromiseSettledResult<any>;
        const enhancement = batchResults[6] as PromiseSettledResult<any>;
        const aetherResult = batchResults[7] as PromiseSettledResult<any>;
        const geckoResult = batchResults[8] as PromiseSettledResult<any>;

        const mintInfo = rpcResult.status === 'fulfilled' ? rpcResult.value : null;
        const helius = heliusResult.status === 'fulfilled' ? heliusResult.value : null;
        const jupPriceData = jupResult.status === 'fulfilled' ? jupResult.value : null;
        const hIntel: any = holderIntel.status === 'fulfilled' ? holderIntel.value : { clusterDetected: false, clusterSize: 0, riskLevel: 'LOW', top10Percent: 0 };
        const bdl: any = bundle.status === 'fulfilled' ? bundle.value : { isBundled: false, percentage: 0, riskLevel: 'LOW' };
        const lpStatus = lp.status === 'fulfilled' ? lp.value : 'unverified';
        const enh: any = enhancement.status === 'fulfilled' ? enhancement.value : { address, tier: 'Basic', socials: {}, customDescription: '' };
        const aetherData = aetherResult.status === 'fulfilled' ? aetherResult.value?.[0] : null;

        isElite = isElite || enh?.tier === 'Elite';

        const parsedData = (mintInfo?.value?.data as any)?.parsed?.info;
        
        // Aether returns current_price and pct_change for Top Movers, but we default to Jupiter pricing.

        // Ensure we have a valid decimal count even if RPC fails
        const decimals = aetherData?.decimals || helius?.decimals || parsedData?.decimals || 9;

        // Circulation Detection: Helius DAS is the ultimate source of truth for supply
        const supply = helius?.supply ? (helius.supply / Math.pow(10, decimals)) :
            (parsedData?.supply ? (parseFloat(parsedData.supply) / Math.pow(10, decimals)) : 0);

        // 2. Resolve Metadata with Hierarchical Priority
        const creator = helius?.owner || (parsedData as any)?.mintAuthority || null;

        const geckoData = geckoResult?.status === 'fulfilled' ? geckoResult.value : null;

        const name = isSol ? 'Solana' : (enh?.name || geckoData?.data?.attributes?.name || aetherData?.name || helius?.name || parsedData?.name || 'VORTEX Asset');
        const symbol = isSol ? 'SOL' : (enh?.symbol || geckoData?.data?.attributes?.symbol || aetherData?.symbol || helius?.symbol || parsedData?.symbol || 'UNKNWN');

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

        // 3. Resolve Price and Market Data
        const jupVal = (jupPriceData as any)?.data?.[address];
        const jupPrice = parseFloat(jupVal?.price || (jupPriceData as any)?.data?.price || (jupPriceData as any)?.price || '0');
        const heliusPrice = parseFloat(helius?.priceUsd || '0');
        const geckoPrice = parseFloat(geckoData?.data?.attributes?.price_usd || '0');
        const currentPrice = jupPrice || geckoPrice || heliusPrice || 0;
        const mcap = parseFloat(geckoData?.data?.attributes?.market_cap_usd || '0');

        // 4. Volume Velocity & Social Proxy (Approximated via Aether / Jupiter defaults)
        const v5m = jupVal?.volume24h ? jupVal.volume24h / 288 : 0; // rough heuristic if available
        const v1h = jupVal?.volume24h ? jupVal.volume24h / 24 : 0;
        const velocityRatio = v1h > 0 ? (v5m / (v1h / 12)) : 0;

        let velocityStatus: 'STAGNANT' | 'STABLE' | 'ACCELERATING' | 'BREAKOUT' = 'STABLE';
        if (velocityRatio > 2.5) velocityStatus = 'BREAKOUT';
        else if (velocityRatio > 1.5) velocityStatus = 'ACCELERATING';
        else if (velocityRatio < 0.5) velocityStatus = 'STAGNANT';

        const velocityScore = Math.min(100, Math.floor(velocityRatio * 33));

        // 5. Fetch Dependent Reconnaissance (Second Batch: Dependencies on first batch)
        const [velocity, cluster, funding] = await Promise.all([
            getMarketVelocity(address, 0, 0, 0).catch(() => ({ score: 50, activityLevel: 'DORMANT' as const })), // Velocity defaults when completely decoupled from Dex volume mapping
            creator ? detectCreatorCluster(creator).catch(() => []) : Promise.resolve([]),
            creator ? traceFundingOrigins(creator).catch(() => null) : Promise.resolve(null)
        ]);

        const logoURI = enh?.iconURI || helius?.logoURI || (helius as any)?.content?.links?.image || geckoData?.data?.attributes?.image_url || '/logo-placeholder.png';

        // 6. Build and Return Tactical Token Object
        const token: any = {
            address,
            name,
            symbol,
            decimals,
            logoURI,
            bannerURI: enh?.bannerURI,
            iconURI: enh?.iconURI,
            priceUsd: currentPrice,
            priceChange24h: Number.isFinite(jupVal?.priceChange24h) ? jupVal.priceChange24h : null,
            volume24h: jupVal?.volume24h || parseFloat(geckoData?.data?.attributes?.volume_usd?.h24 || '0'),
            liquidityUsd: parseFloat(geckoData?.data?.attributes?.total_reserve_in_usd || '0'), 
            fdv: (currentPrice * supply) || parseFloat(geckoData?.data?.attributes?.fdv_usd || '0'),
            mcap: mcap || 0,
            holders: 0, 
            owner: enh?.owner,
            tier: enh?.tier || 'Basic',
            customDescription: enh?.customDescription,
            socials: {
                website: enh?.socials?.website,
                twitter: enh?.socials?.twitter,
                telegram: enh?.socials?.telegram,
            },
            advancedMetrics: {
                top10HolderPercent: hIntel.top10Percent || 0,
                devWalletStatus: helius?.mintAuthority ? 'holding' : 'burnt',
                lpBurnStatus: lpStatus,
                slippage1k: 0,
                slippage10k: 0,
                snipeVolumePercent: bdl.percentage,
                mintAuthority: helius?.mintAuthority ? 'active' : (lpStatus === 'verified' ? 'renounced' : 'active'),
                freezeAuthority: helius?.freezeAuthority ? 'active' : (lpStatus === 'verified' ? 'renounced' : 'active'),
                metadataMutable: true,
                transferFeeBps,
                holderIntelligence: hIntel,
                marketVelocity: velocity,
                volumeVelocity: {
                    score: velocityScore,
                    status: velocityStatus,
                    ratio: velocityRatio
                },
                velocitySentiment: {
                    buyPercent: (velocity.score > 50) ? Math.min(95, velocity.score + 10) : 50,
                    sellPercent: (velocity.score <= 50) ? Math.min(95, 100 - velocity.score + 10) : 50
                },
                cluster: (isElite) ? cluster : [],
                fundingSource: (isElite) ? funding : undefined
            },
            creator: creator,
            securityTags: cluster.length > 0 ? ['HIGH_CHURN_CREATOR', 'SERIAL_LAUNCHER'] : ['LIQUIDITY_DISCOVERED'],
            isSafe: lpStatus === 'verified' && !helius?.mintAuthority && hIntel.top10Percent < 40 && cluster.length < 3
        };

        // 7. Sync to Vortex Indexer (Background)
        if (token.address) {
            syncTokenToServer(token).catch(() => { });
            aetherClient.triggerIndexing(token.address).catch(() => { }); // Launch Sovereign Indexer
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
                tokenAmount: decoded.tokenAmount,
                priceUsd: decoded.tokenAmount > 0 ? (decoded.amountUsd / decoded.tokenAmount) : 0,
                wallet: decoded.signer.slice(0, 4) + '...' + decoded.signer.slice(-4),
                labels
            };

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
/**
 * Server-Sent Events (SSE) Bridge: Connects UI to the Vortex Centralized Stream.
 * Allows global market pulse and token-specific updates without redundant RCP-WS overhead per client.
 */
export const subscribeToServerStream = (address?: string, isDiscovery?: boolean, onUpdate?: (data: any) => void) => {
    if (typeof window === 'undefined') return () => {};

    const url = new URL('/api/stream', window.location.origin);
    if (address) url.searchParams.set('address', address);
    if (isDiscovery) url.searchParams.set('discovery', 'true');

    const eventSource = new EventSource(url.toString());

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (onUpdate) onUpdate(data);
        } catch (e) {
            console.error("VORTEX_SSE_PARSE_ERR:", e);
        }
    };

    // Specific event listeners for typed handling
    eventSource.addEventListener('tx', (e: any) => {
        try {
            const data = JSON.parse(e.data);
            if (onUpdate) onUpdate({ ...data, kind: 'tx' });
        } catch {}
    });

    eventSource.addEventListener('discovery', (e: any) => {
        try {
            const data = JSON.parse(e.data);
            if (onUpdate) onUpdate({ type: 'discovery', ...data });
        } catch {}
    });

    eventSource.onerror = (err) => {
        console.warn("VORTEX_SSE_DISCONNECT: Reconnecting...", err);
        // EventSource handles auto-reconnect by default
    };

    return () => {
        eventSource.close();
    };
};

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
                const endpoint = HELIUS_RPC || RPC_ENDPOINTS.find((e: string) => e.includes('helius')) || RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com';
                wsConn = new Connection(endpoint, 'confirmed');
            }

            subscriptionId = wsConn.onLogs(
                pubkey,
                async (logs, ctx) => {
                    if (!isActive || (typeof document !== 'undefined' && document.visibilityState === 'hidden') || processedSigs.has(logs.signature)) return;

                    // GLOBAL_FIX: Cap module-level processedSigs (was growing indefinitely)
                    processedSigs.add(logs.signature);
                    if (processedSigs.size > 5000) {
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

            // ELITE UX OVERRIDE: Pre-fetch historical transactions immediately so the UI doesn't hang
            fetchHistoricalSignatures();

        } catch (e) {
            if (isActive) {
                console.warn("WEBSOCKET_SUSPENDED: RPC uplink rejected connection. Retrying...", e);
                subscriptionId = null;
                pollInterval = setTimeout(startSubscription, backoffDelay);
                backoffDelay = Math.min(backoffDelay * 2, 60000);
            }
        }
    };

    const fetchHistoricalSignatures = async () => {
        if (!isActive) return;
        try {
            const pk = new PublicKey(address);
            const sigs = await getResilientConnection(c => c.getSignaturesForAddress(pk, { limit: 15 }));

            for (const sigInfo of sigs.reverse()) {
                if (!processedSigs.has(sigInfo.signature)) {
                    processedSigs.add(sigInfo.signature);
                    const tx = await getVortexTransaction(sigInfo.signature, address);
                    if (tx && isActive) onTx(tx);
                }
            }
        } catch (e) {
            console.warn("HISTORICAL_FETCH_FAILURE:", e);
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
