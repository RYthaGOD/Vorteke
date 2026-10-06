import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limiter. It resets when the instance restarts, which is acceptable for a single
// Railway instance; move it to a shared store before running several instances.
const buckets = new Map<string, { count: number, windowStart: number }>();
const WINDOW_MS = 60_000;
const GENERAL_LIMIT = 120; // requests per minute per IP across /api
// Routes that write data, start payments or run chain-heavy lookups get a tighter budget.
const STRICT_LIMIT = 40;
const STRICT_PREFIXES = ['/api/claim', '/api/pay/initiate', '/api/pay/verify', '/api/tokens', '/api/elite', '/api/scan', '/api/auth/provision'];

/**
 * The client address as seen by Railway's edge. Earlier x-forwarded-for entries can be sent by the
 * client itself, so only X-Real-IP or the last (proxy-appended) entry is trusted.
 */
function clientIp(request: NextRequest) {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',').map(part => part.trim()).filter(Boolean);
    return request.headers.get('x-real-ip') || forwarded?.at(-1) || 'unknown';
}

function overLimit(key: string, limit: number, now: number) {
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > WINDOW_MS) {
        buckets.set(key, { count: 1, windowStart: now });
        return false;
    }
    bucket.count++;
    return bucket.count > limit;
}

export function middleware(request: NextRequest) {
    const now = Date.now();
    const ip = clientIp(request);
    const path = request.nextUrl.pathname;
    const write = request.method !== 'GET' && STRICT_PREFIXES.some(prefix => path.startsWith(prefix));
    const chainHeavy = path.startsWith('/api/scan') || path.startsWith('/api/elite/research');
    const strict = write || chainHeavy;

    if (overLimit('all:' + ip, GENERAL_LIMIT, now) || (strict && overLimit('strict:' + ip, STRICT_LIMIT, now))) {
        return NextResponse.json(
            { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Wait a minute and try again.' },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }

    // Evict stale entries so the map can't grow without bound.
    if (buckets.size > 10_000) {
        for (const [key, value] of buckets.entries()) {
            if (now - value.windowStart > WINDOW_MS * 5) buckets.delete(key);
        }
    }

    const response = NextResponse.next();
    // Content-Security-Policy and the other headers are also set in next.config.mjs.
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
}

export const config = {
    matcher: '/api/:path*',
};
