import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');
        const addresses = searchParams.get('addresses')?.split(',');

        if (address) {
            try { new PublicKey(address); } catch { return NextResponse.json({ error: 'INVALID_ADDRESS' }, { status: 400 }); }
            const token = await prisma.token.findUnique({ where: { address } });
            return NextResponse.json(token || { error: 'NOT_FOUND' }, { status: token ? 200 : 404 });
        }

        if (addresses) {
            const results = await prisma.token.findMany({
                where: { address: { in: addresses } }
            });
            return NextResponse.json(results);
        }

        return NextResponse.json({ error: 'INVALID_QUERY' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = await request.json();
        if (!token.address) {
            return NextResponse.json({ error: 'MISSING_ADDRESS' }, { status: 400 });
        }

        const data = {
            name: token.name || 'Unknown',
            symbol: token.symbol || 'UNK',
            logoURI: token.logoURI || null,
            priceUsd: typeof token.priceUsd === 'number' ? token.priceUsd : 0,
            priceChange24h: typeof token.priceChange24h === 'number' ? token.priceChange24h : 0,
            volume24h: typeof token.volume24h === 'number' ? token.volume24h : 0,
            liquidityUsd: typeof token.liquidityUsd === 'number' ? token.liquidityUsd : 0,
            fdv: typeof token.fdv === 'number' ? token.fdv : 0,
            mcap: typeof token.mcap === 'number' ? token.mcap : 0,
            tier: token.tier || 'Basic',
            securityTags: token.securityTags || null,
            advancedMetrics: token.advancedMetrics || null,
            lastUpdated: new Date()
        };

        await prisma.token.upsert({
            where: { address: token.address },
            update: data,
            create: {
                address: token.address,
                ...data
            }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("TOKEN_UPSERT_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
