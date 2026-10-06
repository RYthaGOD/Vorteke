import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { getResilientConnection } from '@/lib/solana/connection';
import { primaryCreator, resolveProjectAuthorities } from '@/lib/solana/creator.mjs';
import { fetchHeliusMetadata } from '@/lib/vortex/token/metadata';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');
        const addresses = searchParams.get('addresses')?.split(',');
        const creator = searchParams.get('creator');

        if (address) {
            try { new PublicKey(address); } catch { return NextResponse.json({ error: 'INVALID_ADDRESS' }, { status: 400 }); }
            const token = await prisma.token.findUnique({ where: { address } });
            return NextResponse.json(token || { error: 'NOT_FOUND' }, { status: token ? 200 : 404 });
        }

        if (creator) {
            const results = await prisma.token.findMany({
                where: { creator },
                take: 50,
                orderBy: { lastUpdated: 'desc' }
            });
            return NextResponse.json(results);
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

const REFRESH_MS = 6 * 3_600_000;

/**
 * Records that a token was viewed. Only the address is taken from the caller: name, symbol,
 * logo and creator are looked up here, so nobody can plant data that claims or page titles trust.
 */
export async function POST(request: NextRequest) {
    try {
        const { address } = await request.json();
        if (typeof address !== 'string') {
            return NextResponse.json({ error: 'MISSING_ADDRESS' }, { status: 400 });
        }
        try { new PublicKey(address); } catch {
            return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
        }

        const existing = await prisma.token.findUnique({ where: { address }, select: { lastUpdated: true } });
        if (existing && Date.now() - existing.lastUpdated.getTime() < REFRESH_MS) {
            return NextResponse.json({ success: true });
        }

        const [metadata, authorities] = await Promise.all([
            fetchHeliusMetadata(address),
            getResilientConnection(c => resolveProjectAuthorities(c, address)).catch(() => null),
        ]);
        if (!metadata?.name && !metadata?.symbol) {
            return NextResponse.json({ error: 'TOKEN_NOT_FOUND' }, { status: 404 });
        }

        const data = {
            name: metadata.name || metadata.symbol,
            symbol: metadata.symbol || '?',
            logoURI: typeof metadata.logoURI === 'string' && metadata.logoURI.startsWith('https://') ? metadata.logoURI : null,
            ...(authorities ? { creator: primaryCreator(authorities) } : {}),
            lastUpdated: new Date()
        };

        await prisma.token.upsert({ where: { address }, update: data, create: { address, ...data } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("TOKEN_UPSERT_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}

