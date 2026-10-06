import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { measureTrendingWindow } from '@/lib/vortex/trending-window.mjs';
import type { TrendingResponse, TrendingToken } from '@/lib/vortex/trending-types';
import { geckoJson } from '@/lib/server/gecko';

type Pool = { attributes: { address: string }; relationships: { base_token: { data: { id: string } } } };
type TokenEntity = { id: string; attributes: { name: string; symbol: string; image_url?: string } };
// Shared provider cache: a rate-limited provider serves the last good answer instead of failing.
async function getJson(path: string): Promise<any> {
    return (await geckoJson(path, 110_000)).data;
}
// Cache the whole batch across visitors. This is a sampled discovery ranking,
// not a claim to rank every Solana token or every liquidity pool.
const loadTrending = unstable_cache(async (): Promise<TrendingResponse> => {
    const discovery: { data: Pool[]; included?: TokenEntity[] } = await getJson('/networks/solana/trending_pools?include=base_token');
    if (!Array.isArray(discovery.data)) throw new Error('INVALID_TRENDING_RESPONSE');
    const metadata = new Map(discovery.included?.map(token => [token.id, token.attributes]));
    const seen = new Set<string>();
    const candidates = discovery.data.filter(pool => {
        const id = pool.relationships?.base_token?.data?.id;
        if (!id || seen.has(id) || !pool.attributes?.address) return false;
        seen.add(id);
        return true;
    }).slice(0, 6);
    // Allow one minute for the provider's documented cache to settle.
    const windowEnd = Math.floor(Date.now() / 60000) * 60 - 60;
    const results = await Promise.allSettled(candidates.map(async (pool): Promise<TrendingToken | null> => {
        const id = pool.relationships.base_token.data.id;
        const address = id.replace(/^solana_/, '');
        const data = await getJson('/networks/solana/pools/' + encodeURIComponent(pool.attributes.address) + '/ohlcv/minute?aggregate=1&limit=30&currency=usd&token=base&include_empty_intervals=true&before_timestamp=' + windowEnd);
        const metrics = measureTrendingWindow(data?.data?.attributes?.ohlcv_list, windowEnd);
        if (!metrics) return null;
        const token = metadata.get(id);
        return { address, poolAddress: pool.attributes.address, name: token?.name || address, symbol: token?.symbol || 'TOKEN', logoURI: token?.image_url || null, ...metrics };
    }));
    const tokens = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
        .filter(token => token.volume30m > 0).sort((a, b) => b.volume30m - a.volume30m);
    if (candidates.length && results.every(result => result.status === 'rejected')) throw new Error('TRENDING_CANDLES_UNAVAILABLE');
    return { tokens, windowEnd, generatedAt: Date.now(), candidateCount: candidates.length, unavailableCount: candidates.length - tokens.length };
}, ['vortex-trending-30m-v1'], { revalidate: 120 });

export async function GET() {
    try { return NextResponse.json(await loadTrending()); }
    catch { return NextResponse.json({ error: 'Thirty-minute market data is temporarily unavailable.' }, { status: 503 }); }
}
