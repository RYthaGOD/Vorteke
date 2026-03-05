import { NextRequest, NextResponse } from 'next/server';
import { fetchHeliusMetadata, fetchTokenData } from '@/lib/dataService';
import { prisma } from '@/lib/prisma';

// Server-side cache to prevent upstream flooding during local dev
let discoveryCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 30000; // 30 seconds

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'trending';
    const cacheKey = `discovery_${type}`;

    // 1. Check Local Dev Cache (Next.js Data Cache handles production)
    const cached = discoveryCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        let tokens: any[] = [];

        if (type === 'search') {
            const query = searchParams.get('q');
            if (!query) return NextResponse.json([]);

            // Search via DexScreener directly for high-fidelity results
            const searchRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${query}`, {
                next: { revalidate: 30 }
            } as any);
            const searchData = await searchRes.json();

            // Map and enrich, enforcing absolute 'solana' chain isolation to prevent unhandled Base58 decode failures
            tokens = (searchData.pairs || [])
                .filter((pair: any) => pair.chainId === 'solana')
                .slice(0, 10).map((pair: any) => ({
                    address: pair.baseToken.address,
                    name: pair.baseToken.name,
                    symbol: pair.baseToken.symbol,
                    priceUsd: parseFloat(pair.priceUsd || '0'),
                    priceChange24h: pair.priceChange?.h24 || 0,
                    volume24h: pair.volume?.h24 || 0,
                    liquidityUsd: pair.liquidity?.usd || 0,
                    logoURI: pair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${pair.baseToken.address}.png`,
                    securityTags: ['ANALYZED', 'DYNAMIC_LIQUIDITY'],
                    advancedMetrics: {
                        lpBurnStatus: 'pending',
                        mintAuthority: 'checking',
                        freezeAuthority: 'checking',
                        sentiment: { buyPercent: 50, sellPercent: 50 }
                    }
                }));

            return NextResponse.json(tokens);
        }

        const baseUrl = 'https://api.geckoterminal.com/api/v2';
        let geckoPath = '';

        switch (type) {
            case 'top100': geckoPath = 'networks/solana/pools'; break;
            case 'pumpfun':
                try {
                    // Pump.fun tokens via DexScreener pairs on pumpswap dex
                    const pumpRes = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana/pumpfun', {
                        next: { revalidate: 60 }
                    } as any);
                    if (!pumpRes.ok) throw new Error('DEX_PUMP_SEARCH_DOWN');
                    const pumpData = await pumpRes.json();

                    const pTokens = (pumpData.pairs || [])
                        .filter((p: any) => p.chainId === 'solana')
                        .slice(0, 25)
                        .map((p: any) => ({
                            address: p.baseToken.address,
                            name: p.baseToken.name,
                            symbol: p.baseToken.symbol,
                            priceUsd: parseFloat(p.priceUsd || '0'),
                            priceChange24h: p.priceChange?.h24 || 0,
                            volume24h: p.volume?.h24 || 0,
                            liquidityUsd: p.liquidity?.usd || 0,
                            mcap: p.fdv || 0,
                            logoURI: p.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${p.baseToken.address}.png`,
                            securityTags: ['PUMP_ORIGIN', 'BONDING_CURVE']
                        }));
                    return NextResponse.json(pTokens);
                } catch (e) {
                    console.warn("PUMP_FETCH_FAIL, falling back to trending", e);
                    // Fall through to gecko trending as fallback
                    geckoPath = 'networks/solana/trending_pools';
                    break;
                }
            case 'new': geckoPath = 'networks/solana/new_pools'; break;
            case 'gainers':
                try {
                    // DexScreener gainers: trending Solana pairs with highest positive 24h shift
                    const gainRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
                        next: { revalidate: 60 }
                    } as any);
                    if (!gainRes.ok) throw new Error('GAIN_FETCH_FAIL');
                    const gainData = await gainRes.json();

                    // Get up to 30 addresses from the token profiles feed
                    const addresses = (gainData || [])
                        .filter((t: any) => t.chainId === 'solana' && t.tokenAddress)
                        .slice(0, 30)
                        .map((t: any) => t.tokenAddress)
                        .join(',');

                    if (!addresses) throw new Error('NO_GAIN_ADDRS');

                    const pairsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`, {
                        next: { revalidate: 60 }
                    } as any);
                    const pairsData = await pairsRes.json();

                    const seen = new Set();
                    const gainTokens = (pairsData.pairs || [])
                        .filter((p: any) => p.chainId === 'solana' && !seen.has(p.baseToken.address) && seen.add(p.baseToken.address))
                        .sort((a: any, b: any) => (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0))
                        .slice(0, 25)
                        .map((p: any) => ({
                            address: p.baseToken.address,
                            name: p.baseToken.name,
                            symbol: p.baseToken.symbol,
                            priceUsd: parseFloat(p.priceUsd || '0'),
                            priceChange24h: p.priceChange?.h24 || 0,
                            volume24h: p.volume?.h24 || 0,
                            liquidityUsd: p.liquidity?.usd || 0,
                            mcap: p.fdv || 0,
                            logoURI: p.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${p.baseToken.address}.png`,
                            securityTags: ['GAINER', 'HOT_SIGNAL']
                        }));

                    discoveryCache[cacheKey] = { data: gainTokens, timestamp: Date.now() };
                    return NextResponse.json(gainTokens);
                } catch (e) {
                    console.warn("GAINERS_FETCH_FAIL, falling back to trending sorted", e);
                    geckoPath = 'networks/solana/trending_pools';
                    break;
                }
            case 'losers': geckoPath = 'networks/solana/trending_pools'; break;
            default: geckoPath = 'networks/solana/trending_pools';
        }

        // 2. Fetch Base Pools from GeckoTerminal
        let geckoData: any = { data: [] };
        try {
            const geckoRes = await fetch(`${baseUrl}/${geckoPath}`, {
                next: { revalidate: 30 } // Vercel Data Cache
            } as any);
            if (geckoRes.ok) {
                geckoData = await geckoRes.json();
            } else {
                console.warn(`GECKO_FAILURE: ${geckoRes.status}`);
            }
        } catch (e) {
            console.warn("GECKO_FETCH_NETWORK_FAIL", e);
        }

        const poolAddresses = geckoData.data?.map((p: any) => p.relationships?.base_token?.data?.id?.split('_')[1]).filter(Boolean) || [];
        const addressesToFetch = poolAddresses.slice(0, 30); // DexScreener supports max 30 per explicit request

        // 3. Multi-Source Enhancement (Batching: 1 request instead of 30)
        let enhancedTokens: any[] = [];
        const neededAddresses: string[] = [];

        // DB Pass (Hardened against connection failure)
        let existingMap = new Map();
        try {
            const existingRecords = await prisma.token.findMany({
                where: { address: { in: addressesToFetch } }
            });
            existingRecords.forEach((r: any) => existingMap.set(r.address, r));

            for (const addr of addressesToFetch) {
                const existing = existingMap.get(addr);
                if (existing && (Date.now() - new Date(existing.lastUpdated).getTime() < 60000)) {
                    enhancedTokens.push(existing);
                } else {
                    neededAddresses.push(addr);
                }
            }
        } catch (dbErr) {
            console.warn("DB_RECON_FAILURE, falling back to batch API", dbErr);
            neededAddresses.push(...addressesToFetch);
        }

        // Batch Fetch Pass
        if (neededAddresses.length > 0) {
            try {
                const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${neededAddresses.join(',')}`, {
                    next: { revalidate: 30 }
                } as any);
                const dexData = await res.json();

                if (dexData.pairs) {
                    const processedAddrs = new Set();
                    for (const pair of dexData.pairs) {
                        const addr = pair.baseToken.address;
                        if (processedAddrs.has(addr)) continue;
                        processedAddrs.add(addr);

                        const tokenInfo = {
                            address: addr,
                            name: pair.baseToken.name,
                            symbol: pair.baseToken.symbol,
                            priceUsd: parseFloat(pair.priceUsd || '0'),
                            priceChange24h: pair.priceChange?.h24 || 0,
                            volume24h: pair.volume?.h24 || 0,
                            liquidityUsd: pair.liquidity?.usd || 0,
                            fdv: pair.fdv || 0,
                            mcap: pair.fdv || 0,
                            logoURI: pair.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${addr}.png`,
                            advancedMetrics: {
                                lpBurnStatus: 'pending',
                                mintAuthority: 'checking',
                                freezeAuthority: 'checking',
                                sentiment: { buyPercent: 50, sellPercent: 50 }
                            },
                            securityTags: ['LIQUIDITY_DISCOVERED', 'AGGREGRATED_SOURCE'],
                            lastUpdated: new Date()
                        };

                        try {
                            await prisma.token.upsert({
                                where: { address: addr },
                                update: tokenInfo,
                                create: tokenInfo
                            });
                        } catch (prismaErr) {
                            console.warn("DB_PERSIST_WARN", prismaErr);
                        }

                        enhancedTokens.push(tokenInfo);
                    }
                }
            } catch (e) {
                console.error("BATCH_FETCH_ERR:", e);
            }
        }

        let filteredTokens = enhancedTokens.filter(Boolean);

        if (type === 'gainers') {
            filteredTokens.sort((a, b) => b.priceChange24h - a.priceChange24h);
        } else if (type === 'losers') {
            filteredTokens.sort((a, b) => a.priceChange24h - b.priceChange24h);
        }

        // 4. Update Cache & Return
        discoveryCache[cacheKey] = { data: filteredTokens, timestamp: Date.now() };
        return NextResponse.json(filteredTokens);

    } catch (error: any) {
        console.error('AGGREGATOR_ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
