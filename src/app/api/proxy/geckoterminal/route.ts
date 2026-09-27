import { NextRequest, NextResponse } from 'next/server';

const CACHE = new Map<string, { data: any, expires: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const type = searchParams.get('type') || 'minute'; // minute, hour, day
    const limit = searchParams.get('limit') || '1000';
    const aggregate = searchParams.get('aggregate') || '1';
    const beforeTimestamp = searchParams.get('before_timestamp');

    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const cacheKey = `${address}-${type}-${aggregate}-${limit}-${beforeTimestamp || 'now'}`;
    const cached = CACHE.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
        return NextResponse.json(cached.data);
    }

    try {
        // POOL_RESOLUTION_LOGIC: Use hardcoded high-liquidity pools for majors to bypass search latency/errors
        let poolAddress = '';
        const MAJOR_POOLS: Record<string, string> = {
            'So11111111111111111111111111111111111111112': '58oQChkaZneNq3VWJhvSbtvSipBnSbkfGoDhaurNoY83', // SOL/USDC Raydium
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': '58oQChkaZneNq3VWJhvSbtvSipBnSbkfGoDhaurNoY83', // USDC (via SOL pool)
            'DezXAZhfjsmAW3kz8fWkbeXp5oV8Xyit2nXU3C8sqxg': '896cs9N6sq79XmSpWHeU4vFvYEnnE9zS2S87X2m8vEPr', // BONK/SOL Raydium
            'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': '9pE6MbhRzJSTm89U7N9p7X6nTYfR1A1PAtXpW327k44B', // JUP/SOL Raydium
        };

        if (MAJOR_POOLS[address]) {
            poolAddress = MAJOR_POOLS[address];
        } else {
            const searchUrl = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${address}/pools?page=1`;
            const searchRes = await fetch(searchUrl, {
                headers: { 'Accept': 'application/json;version=20230302' },
                next: { revalidate: 300 } // Parallel caching at Next.js level
            });

            if (!searchRes.ok) {
                return NextResponse.json({ error: 'Token pools not found' }, { status: 404 });
            }

            const searchData = await searchRes.json();
            const pools = searchData?.data || [];
            const topPool = pools[0];
            poolAddress = topPool?.attributes?.address;
        }

        if (!poolAddress) {
            return NextResponse.json({ error: 'No active pools found' }, { status: 404 });
        }

        let geckoUrl = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${type}?aggregate=${aggregate}&limit=${limit}`;
        if (beforeTimestamp) {
            geckoUrl += `&before_timestamp=${beforeTimestamp}`;
        }

        const response = await fetch(geckoUrl, {
            headers: {
                'Accept': 'application/json;version=20230302',
                'User-Agent': 'Vortex/1.0'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            return NextResponse.json({ error: 'GeckoTerminal unavailable' }, { status: response.status });
        }

        const data = await response.json();
        
        // Populate In-Memory Cache
        CACHE.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
        
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
