import { NextRequest, NextResponse } from 'next/server';
import { dataHeaders, geckoJson } from '@/lib/server/gecko';

// Allowlist: Only permit paths that start with recognized GeckoTerminal resource types
const ALLOWED_PATH_PREFIXES = [
    'networks/solana/pools',
    'networks/solana/tokens',
    'networks/solana/trending_pools',
    'networks/solana/new_pools',
    'networks/solana/ohlcv',
];

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // FIX: Sanitize path to prevent SSRF / path traversal attacks
    // Remove any leading slashes, dots, or protocol prefixes
    const cleanPath = path.replace(/^[\/\.]+/, '').replace(/\.\./g, '');

    // Validate against allowlist to ensure only GeckoTerminal resources are reachable
    const isAllowed = ALLOWED_PATH_PREFIXES.some(prefix => cleanPath.startsWith(prefix));
    if (!isAllowed) {
        return NextResponse.json({ error: 'FORBIDDEN_PATH' }, { status: 403 });
    }

    try {
        const targetUrl = new URL('https://placeholder.invalid/' + cleanPath);

        // Forward only safe, known query params
        const SAFE_PARAMS = ['aggregate', 'limit', 'ohlcv_limit', 'currency', 'token', 'page', 'include'];
        searchParams.forEach((value, key) => {
            if (key !== 'path' && SAFE_PARAMS.includes(key)) {
                targetUrl.searchParams.append(key, value);
            }
        });

        // Shared cache: repeated views of a token reuse one provider call, and a rate limit serves the last answer.
        const { data, at, stale } = await geckoJson(targetUrl.pathname + targetUrl.search, 60_000);
        return NextResponse.json(data, { headers: dataHeaders(at, stale) });
    } catch (error) {
        console.error('GECKO_PROXY_ERROR:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
