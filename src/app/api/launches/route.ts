import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';

export async function GET() {
    try {
        // Fetch new pools from GeckoTerminal
        const geckoRes = await fetch(`${GECKO_BASE}/networks/solana/new_pools?include=base_token,dex`, {
            next: { revalidate: 30 } // Cache for 30s
        });

        if (!geckoRes.ok) {
            throw new Error(`GECKO_API_ERROR: ${geckoRes.status}`);
        }

        const geckoData = await geckoRes.json();
        
        // Map the pools to a cleaner format with Launchpad context
        const launches = (geckoData.data || []).map((pool: any) => {
            const baseTokenId = pool.relationships?.base_token?.data?.id?.split('_')[1];
            const dexId = pool.relationships?.dex?.data?.id || 'unknown';
            
            // Format Launchpad name and styling
            let launchpad = 'Raydium';
            let launchpadColor = 'text-vortex-cyan';
            
            if (dexId === 'pump-fun') {
                launchpad = 'Pump.fun';
                launchpadColor = 'text-vortex-green';
            } else if (dexId === 'meteora') {
                launchpad = 'Meteora';
                launchpadColor = 'text-vortex-purple';
            } else if (dexId === 'orca') {
                launchpad = 'Orca';
                launchpadColor = 'text-vortex-yellow';
            }

            return {
                address: baseTokenId,
                name: pool.attributes.name,
                priceUsd: parseFloat(pool.attributes.base_token_price_usd || '0'),
                liquidityUsd: parseFloat(pool.attributes.reserve_in_usd || '0'),
                volume24h: parseFloat(pool.attributes.volume_usd?.h24 || '0'),
                poolCreatedAt: pool.attributes.pool_created_at,
                launchpad,
                launchpadColor,
                dexId,
            };
        }).filter((p: any) => p.address); // Ensure we have a valid token address

        // Fetch Elite enhancements to see if any new launches are boosted
        const enhancedAddresses = launches.map((l: any) => l.address);
        const enhancements = await prisma.enhancement.findMany({
            where: { address: { in: enhancedAddresses } }
        });

        const enhancedLaunches = launches.map((launch: any) => {
            const enh = enhancements.find(e => e.address === launch.address);
            if (enh) {
                return {
                    ...launch,
                    tier: enh.tier,
                    burnAmount: enh.burnAmount,
                    logoURI: enh.iconURI,
                    isVerified: true
                };
            }
            return launch;
        });

        return NextResponse.json(enhancedLaunches);

    } catch (error: any) {
        console.error('LAUNCHES_API_ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
