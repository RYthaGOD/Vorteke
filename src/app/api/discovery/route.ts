import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';
type Entity = { id: string; attributes: Record<string, any>; relationships?: Record<string, { data?: { id: string } }> };
type MarketToken = { address: string; name: string; symbol: string; priceUsd: number; priceChange24h: number | null; volume24h: number; liquidityUsd: number; fdv: number; mcap: number | null; logoURI: string | null; securityTags: string[]; tier: string; };
async function upstream(path: string) {
    const response = await fetch(GECKO_BASE + path, { signal: AbortSignal.timeout(12000), next: { revalidate: 30 } });
    if (!response.ok) throw new Error('MARKET_PROVIDER_UNAVAILABLE');
    return response.json() as Promise<{ data: Entity[]; included?: Entity[] }>;
}
export async function GET(req: NextRequest) {
    const type = req.nextUrl.searchParams.get('type') || 'trending';
    try {
        let tokens: MarketToken[] = [];
        if (type === 'verified' || type === 'captured') {
            const profiles = type === 'verified'
                ? await prisma.enhancement.findMany({ where: { tier: { not: 'Basic' } }, orderBy: { lastPaymentTime: 'desc' }, take: 30, select: { address: true } })
                : await prisma.token.findMany({ orderBy: { lastUpdated: 'desc' }, take: 30, select: { address: true } });
            if (!profiles.length) return NextResponse.json([]);
            const response = await upstream('/networks/solana/tokens/multi/' + profiles.map(p => p.address).join(','));
            tokens = response.data.map(({ attributes: a }) => ({
                address: a.address, name: a.name, symbol: a.symbol, priceUsd: Number(a.price_usd || 0),
                priceChange24h: null, volume24h: Number(a.volume_usd?.h24 || 0), liquidityUsd: Number(a.total_reserve_in_usd || 0),
                fdv: Number(a.fdv_usd || 0), mcap: a.market_cap_usd == null ? null : Number(a.market_cap_usd),
                logoURI: a.image_url || null, securityTags: [], tier: 'Basic',
            }));
        } else {
            const query = req.nextUrl.searchParams.get('q')?.trim().slice(0, 100) || '';
            if (type === 'search' && !query) return NextResponse.json([]);
            const path = type === 'search' ? '/search/pools?network=solana&query=' + encodeURIComponent(query)
                : '/networks/solana/' + (type === 'new' || type === 'pumpfun' ? 'new_pools' : type === 'top100' ? 'pools' : 'trending_pools') + '?page=1';
            const response = await upstream(path + '&include=base_token');
            const metadata = new Map(response.included?.map(item => [item.id, item.attributes]));
            const seen = new Set<string>();
            for (const pool of response.data) {
                const id = pool.relationships?.base_token?.data?.id;
                const address = id?.replace(/^solana_/, '');
                const dex = pool.relationships?.dex?.data?.id || '';
                if (!address || seen.has(address) || (type === 'pumpfun' && !dex.includes('pump'))) continue;
                seen.add(address);
                const a = pool.attributes, token = metadata.get(id!) || {};
                tokens.push({ address, name: token.name || a.name?.split(' / ')[0] || address, symbol: token.symbol || a.name?.split(' / ')[0] || '?',
                    priceUsd: Number(a.base_token_price_usd || 0), priceChange24h: a.price_change_percentage?.h24 == null ? null : Number(a.price_change_percentage.h24),
                    volume24h: Number(a.volume_usd?.h24 || 0), liquidityUsd: Number(a.reserve_in_usd || 0),
                    fdv: Number(a.fdv_usd || 0), mcap: a.market_cap_usd == null ? null : Number(a.market_cap_usd),
                    logoURI: token.image_url || null, securityTags: [], tier: 'Basic' });
            }
        }
        // Paid profiles only decorate market data; if the database is unreachable, still serve the market.
        const enhancements = await prisma.enhancement.findMany({ where: { address: { in: tokens.map(t => t.address) } } })
            .catch((error) => { console.error('DISCOVERY_PROFILES_UNAVAILABLE', error); return []; });
        const profiles = new Map(enhancements.map(e => [e.address, e]));
        const data = tokens.map(token => { const profile = profiles.get(token.address); return { ...token, tier: profile?.tier || 'Basic', logoURI: profile?.iconURI || token.logoURI }; });
        if (type === 'gainers') data.sort((a, b) => (b.priceChange24h ?? -Infinity) - (a.priceChange24h ?? -Infinity));
        else if (type === 'losers') data.sort((a, b) => (a.priceChange24h ?? Infinity) - (b.priceChange24h ?? Infinity));
        // Paid placement is shown separately from the organic discovery order.
        return NextResponse.json(data);
    } catch (error) {
        console.error('DISCOVERY_UNAVAILABLE', error);
        return NextResponse.json({ error: 'MARKET_DATA_UNAVAILABLE' }, { status: 503 });
    }
}
