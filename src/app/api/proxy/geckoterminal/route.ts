import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const type = searchParams.get('type') || 'minute'; // minute, hour, day
    const limit = searchParams.get('limit') || '1000';
    const aggregate = searchParams.get('aggregate') || '1';

    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    try {
        // POOL_RESOLUTION_LOGIC: Use hardcoded high-liquidity pools for majors to bypass search latency/errors
        // This ensures the Absolute Source of Truth for Top-Tier assets.
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
                headers: { 'Accept': 'application/json;version=20230302' }
            });

            if (!searchRes.ok) {
                return NextResponse.json({ error: 'Token pools not found (Upstream DNS/Auth Failure)' }, { status: 404 });
            }

            const searchData = await searchRes.json();
            const pools = searchData?.data || [];
            const topPool = pools[0];
            poolAddress = topPool?.attributes?.address;
        }

        if (!poolAddress) {
            console.error(`GECKOTERMINAL_NO_POOL_FOUND: Token ${address}`);
            return NextResponse.json({ error: 'No active pools found for this token on GeckoTerminal. Market shallow.' }, { status: 404 });
        }
        const beforeTimestamp = searchParams.get('before_timestamp');

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
            console.error(`GECKOTERMINAL_UPSTREAM_ERR [${response.status}]:`, errText);
            return NextResponse.json({ error: 'GeckoTerminal unavailable', details: errText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("GECKOTERMINAL_PROXY_EXCEPTION:", error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
