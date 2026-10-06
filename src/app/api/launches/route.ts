import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dataHeaders, geckoJson } from '@/lib/server/gecko';
import { publicProfile } from '@/lib/profiles.mjs';

type Pool = { attributes: Record<string, any>; relationships?: Record<string, { data?: { id: string } }> };

const LAUNCHPADS: Record<string, [string, string]> = {
    'pump-fun': ['Pump.fun', 'text-vortex-green'],
    'pumpswap': ['PumpSwap', 'text-vortex-green'],
    'meteora': ['Meteora', 'text-vortex-purple'],
    'meteora-damm-v2': ['Meteora', 'text-vortex-purple'],
    'orca': ['Orca', 'text-vortex-yellow'],
};

export async function GET() {
    try {
        const { data: geckoData, at, stale } = await geckoJson<{ data: Pool[] }>('/networks/solana/new_pools?include=base_token,dex', 30_000);

        const launches = (geckoData.data || []).map(pool => {
            const address = pool.relationships?.base_token?.data?.id?.split('_')[1];
            const dexId = pool.relationships?.dex?.data?.id || 'unknown';
            const [launchpad, launchpadColor] = LAUNCHPADS[dexId] || (dexId.startsWith('raydium') ? ['Raydium', 'text-vortex-cyan'] : [dexId, 'text-vortex-cyan']);
            return {
                address,
                name: pool.attributes.name,
                priceUsd: parseFloat(pool.attributes.base_token_price_usd || '0'),
                liquidityUsd: parseFloat(pool.attributes.reserve_in_usd || '0'),
                volume24h: parseFloat(pool.attributes.volume_usd?.h24 || '0'),
                poolCreatedAt: pool.attributes.pool_created_at,
                launchpad,
                launchpadColor,
                dexId,
            };
        }).filter(launch => launch.address);

        // Paid profiles decorate the list; an unreachable database never hides it.
        const enhancements = await prisma.enhancement.findMany({ where: { address: { in: launches.map(l => l.address!) } } })
            .catch(error => { console.error('LAUNCHES_PROFILES_UNAVAILABLE', error); return []; });
        const profiles = new Map(enhancements.map(e => [e.address, publicProfile(e)!]));
        const decorated = launches.map(launch => {
            const profile = profiles.get(launch.address!);
            return profile && profile.tier !== 'Basic'
                ? { ...launch, tier: profile.tier, boosted: profile.boosted, logoURI: profile.iconURI, isVerified: true }
                : launch;
        });

        return NextResponse.json(decorated, { headers: dataHeaders(at, stale) });
    } catch (error) {
        console.error('LAUNCHES_API_ERROR:', error);
        return NextResponse.json({ error: 'MARKET_DATA_UNAVAILABLE' }, { status: 503 });
    }
}
