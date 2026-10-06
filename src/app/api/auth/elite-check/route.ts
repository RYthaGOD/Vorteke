import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const wallet = searchParams.get('wallet');

        if (!wallet) {
            return NextResponse.json({ error: 'MISSING_WALLET' }, { status: 400 });
        }
        try { new PublicKey(wallet); } catch {
            return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
        }

        const access = await prisma.eliteAccess.findUnique({ where: { wallet } });
        if (!access) {
            return NextResponse.json({ isElite: false });
        }
        if (access.expiresAt < new Date()) {
            return NextResponse.json({ isElite: false, reason: 'EXPIRED', expiresAt: access.expiresAt.toISOString() });
        }

        return NextResponse.json({
            isElite: true,
            source: access.source,
            expiresAt: access.expiresAt.toISOString()
        });
    } catch (e: any) {
        console.error("ELITE_CHECK_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
