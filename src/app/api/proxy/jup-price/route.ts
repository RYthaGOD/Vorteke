import { NextRequest, NextResponse } from 'next/server';

type Price = { price: string; priceChange24h: number | null };
export async function GET(req: NextRequest) {
    const ids = req.nextUrl.searchParams.get('ids')?.split(',') || [];
    if (!ids.length || ids.length > 50 || ids.some(id => !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id))) {
        return NextResponse.json({ error: 'Provide between 1 and 50 valid Solana mint addresses.' }, { status: 400 });
    }
    const apiKey = process.env.JUPITER_API_KEY || process.env.NEXT_PUBLIC_JUPITER_API_KEY;
    {
        try {
            const response = await fetch('https://api.jup.ag/price/v3?ids=' + encodeURIComponent(ids.join(',')), {
                headers: { Accept: 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
                signal: AbortSignal.timeout(8000), next: { revalidate: 5 },
            });
            if (response.ok) {
                const prices: Record<string, { usdPrice?: number; priceChange24h?: number }> = await response.json();
                const data = Object.fromEntries(Object.entries(prices).filter(([, value]) => Number.isFinite(value.usdPrice) && value.usdPrice! > 0)
                    .map(([id, value]) => [id, { price: String(value.usdPrice), priceChange24h: Number.isFinite(value.priceChange24h) ? value.priceChange24h : null }]));
                if (Object.keys(data).length) return NextResponse.json({ data, source: 'Jupiter', cacheSeconds: 5 });
            }
        } catch { /* Fall back to explicitly labelled market snapshots. */ }
    }
    try {
        const data: Record<string, Price> = {};
        for (let offset = 0; offset < ids.length; offset += 30) {
            const response = await fetch('https://api.geckoterminal.com/api/v2/networks/solana/tokens/multi/' + ids.slice(offset, offset + 30).join(','), {
                signal: AbortSignal.timeout(10000), next: { revalidate: 60 },
            });
            if (!response.ok) throw new Error('Market provider unavailable');
            const body: { data: { attributes: { address: string; price_usd: string } }[] } = await response.json();
            for (const { attributes: token } of body.data || []) {
                if (ids.includes(token.address) && Number.isFinite(Number(token.price_usd)) && Number(token.price_usd) > 0) {
                    data[token.address] = { price: token.price_usd, priceChange24h: null };
                }
            }
        }
        return NextResponse.json({ data, source: 'GeckoTerminal', cacheSeconds: 60 });
    } catch {
        return NextResponse.json({ error: 'Price providers are temporarily unavailable.' }, { status: 503 });
    }
}
