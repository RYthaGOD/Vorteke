import { NextRequest, NextResponse } from 'next/server';

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITER: Token Bucket (60 RPM = 1 req/sec)
// ═══════════════════════════════════════════════════════════════════════════
const RATE_LIMIT = 60; // max requests per minute
const REFILL_INTERVAL_MS = 60_000; // 1 minute
let tokenBucket = RATE_LIMIT;
let lastRefill = Date.now();

function tryConsumeToken(): boolean {
    const now = Date.now();
    const elapsed = now - lastRefill;

    if (elapsed >= REFILL_INTERVAL_MS) {
        tokenBucket = RATE_LIMIT;
        lastRefill = now;
    } else {
        // Gradual refill: add tokens proportional to elapsed time
        const tokensToAdd = Math.floor((elapsed / REFILL_INTERVAL_MS) * RATE_LIMIT);
        tokenBucket = Math.min(RATE_LIMIT, tokenBucket + tokensToAdd);
        if (tokensToAdd > 0) lastRefill = now;
    }

    if (tokenBucket > 0) {
        tokenBucket--;
        return true;
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE CACHE: Avoid duplicate upstream calls for the same candle request
// ═══════════════════════════════════════════════════════════════════════════
interface CacheEntry { data: any; timestamp: number; }
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds — charts don't need sub-60s updates for standard views
const CACHE_MAX_ENTRIES = 200; // Increased significantly for multi-token tracking

function getCached(key: string): any | null {
    const entry = responseCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        responseCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key: string, data: any) {
    // Evict oldest entries if over capacity
    if (responseCache.size >= CACHE_MAX_ENTRIES) {
        const oldest = responseCache.keys().next().value;
        if (oldest) responseCache.delete(oldest);
    }
    responseCache.set(key, { data, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const type = searchParams.get('type') || '1m';
    const time_from = searchParams.get('time_from');
    const time_to = searchParams.get('time_to');

    if (!address || !time_from || !time_to) {
        return NextResponse.json({ error: 'Missing required chart parameters' }, { status: 400 });
    }

    if (!BIRDEYE_API_KEY) {
        return NextResponse.json({ error: 'BIRDEYE_API_KEY_NOT_CONFIGURED' }, { status: 503 });
    }

    // 1. Check cache first (free, no rate limit consumed)
    const cacheKey = `${address}_${type}_${time_from}_${time_to}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return NextResponse.json(cached);
    }

    // 2. Rate limit check
    if (!tryConsumeToken()) {
        console.warn(`BIRDEYE_RATE_LIMIT_HIT: ${tokenBucket} tokens remaining`);
        return NextResponse.json(
            { error: 'RATE_LIMIT_EXCEEDED', retryAfterMs: 1000 },
            { status: 429 }
        );
    }

    try {
        if (!BIRDEYE_API_KEY) {
            console.error("BIRDEYE_PROXY_CRITICAL: API Key Missing in Environment");
            return NextResponse.json({ error: 'BIRDEYE_NOT_CONFIGURED' }, { status: 503 });
        }

        // v3 endpoint per Birdeye docs
        const targetUrl = `https://public-api.birdeye.so/defi/v3/ohlcv?address=${address}&type=${type}&time_from=${time_from}&time_to=${time_to}`;

        console.debug(`BIRDEYE_REQUEST: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'X-API-KEY': BIRDEYE_API_KEY,
                'x-chain': 'solana',
                'Accept': 'application/json'
            },
            // Reduce timeout for snappier fallbacks
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`BIRDEYE_UPSTREAM_FAIL: ${response.status} | Error: ${errorText}`);
            return NextResponse.json({ error: `BIRDEYE_${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        setCache(cacheKey, data);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('BIRDEYE_PROXY_EXCEPTION:', error.message || error);
        return NextResponse.json({
            error: 'PROXY_INTERNAL_ERROR',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
