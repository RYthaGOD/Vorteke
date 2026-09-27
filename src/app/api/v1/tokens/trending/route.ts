import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/apiAuth';
import { verifyLPBurn, getHolderConcentration, getMarketVelocity } from '@/lib/vortex/token/metrics';

const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';

// On-chain enrichment (LP burn check, holder concentration) costs RPC calls per token,
// so only the top N results get enriched. Raise this once you have a dedicated RPC budget
// for API traffic separate from the frontend's.
const ENRICH_LIMIT = 10;

interface TrendingToken {
    address: string;
    name: string;
    symbol: string;
    priceUsd: number;
    volume24h: number;
    liquidityUsd: number;
    mcap: number;
    logoURI: string | null;
    lpBurnStatus?: 'verified' | 'unverified' | 'locked';
    holderConcentration?: { clusterDetected: boolean; riskLevel: string; top10Percent: number };
    marketVelocity?: { score: number; activityLevel: string };
}

export async function GET(req: NextRequest) {
    const auth = await requireApiKey(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50);

    try {
        const geckoRes = await fetch(`${GECKO_BASE}/networks/solana/trending_pools`);
        if (!geckoRes.ok) {
            return NextResponse.json({ error: 'UPSTREAM_ERROR', message: 'GeckoTerminal request failed' }, { status: 502 });
        }
        const geckoData = await geckoRes.json();
        const poolAddresses: string[] = (geckoData.data || [])
            .map((p: any) => p.relationships?.base_token?.data?.id?.split('_')[1])
            .filter(Boolean)
            .slice(0, limit);

        if (poolAddresses.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const tokensRes = await fetch(`${GECKO_BASE}/networks/solana/tokens/multi/${poolAddresses.join(',')}`);
        const tokensData = tokensRes.ok ? await tokensRes.json() : { data: [] };

        const tokens: TrendingToken[] = (tokensData.data || []).map((t: any) => ({
            address: t.attributes.address,
            name: t.attributes.name,
            symbol: t.attributes.symbol,
            priceUsd: parseFloat(t.attributes.price_usd || '0'),
            volume24h: parseFloat(t.attributes.volume_usd?.h24 || '0'),
            liquidityUsd: parseFloat(t.attributes.total_reserve_in_usd || '0'),
            mcap: parseFloat(t.attributes.fdv_usd || '0'),
            logoURI: t.attributes.image_url || null,
        }));

        const toEnrich = tokens.slice(0, ENRICH_LIMIT);
        const enriched = await Promise.all(
            toEnrich.map(async (token) => {
                try {
                    const [lpBurnStatus, holderConcentration, marketVelocity] = await Promise.all([
                        verifyLPBurn(token.address),
                        getHolderConcentration(token.address),
                        getMarketVelocity(token.address, token.volume24h, 0, token.liquidityUsd),
                    ]);
                    return { ...token, lpBurnStatus, holderConcentration, marketVelocity };
                } catch {
                    // On-chain enrichment is best-effort; a failure here shouldn't drop the token from results.
                    return token;
                }
            })
        );

        const rest = tokens.slice(ENRICH_LIMIT);
        return NextResponse.json({ data: [...enriched, ...rest] });
    } catch (error: any) {
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
    }
}
