import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for live token pricing.
 * Migrated to DexScreener due to Jupiter V2 401 Unauthorized errors on public endpoints.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    if (!ids) {
        return NextResponse.json({ error: 'MISSING_IDS' }, { status: 400 });
    }

    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ids}`, {
            next: { revalidate: 0 }, // Always fresh for chart ticker
        });

        if (!res.ok) {
            return NextResponse.json({ error: `DEXSCREENER_ERROR: ${res.status}` }, { status: res.status });
        }

        const data = await res.json();

        // Map DexScreener response to match the expected format of the Jupiter proxy
        // (so the frontend chart hook doesn't need to be rewritten)
        const price = data?.pairs?.[0]?.priceUsd || "0";

        return NextResponse.json({
            data: {
                [ids]: { price }
            }
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            }
        });
    } catch (e: any) {
        console.error('PRICE_PROXY_ERROR:', e);
        return NextResponse.json({ error: 'PROXY_FAILURE' }, { status: 500 });
    }
}
