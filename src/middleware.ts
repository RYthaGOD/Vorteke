import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiter for edge/middleware context
// Note: This resets on instance reboot/cold start, but provides a baseline defense.
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();

const RATE_LIMIT_THRESHOLD = 50; // Requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

export function middleware(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();

    // 1. Rate Limiting Logic
    const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now };

    if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
        rateData.count = 1;
        rateData.lastReset = now;
    } else {
        rateData.count++;
    }

    rateLimitMap.set(ip, rateData);

    if (rateData.count > RATE_LIMIT_THRESHOLD && request.nextUrl.pathname.startsWith('/api')) {
        return NextResponse.json(
            { error: 'RATE_LIMIT_EXCEEDED: Tactical cooldown in progress.' },
            { status: 429 }
        );
    }

    const response = NextResponse.next();

    // 2. Global Security Headers (Redundant to next.config.mjs but good practice for middleware)
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: wss:; frame-src 'none';");

    return response;
}

export const config = {
    matcher: '/api/:path*',
};
