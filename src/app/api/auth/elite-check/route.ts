import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const wallet = searchParams.get('wallet');

        if (!wallet) {
            return NextResponse.json({ error: 'MISSING_WALLET' }, { status: 400 });
        }

        const access = await prisma.testAccess.findUnique({
            where: { wallet }
        });

        if (!access) {
            return NextResponse.json({ isElite: false });
        }

        const now = new Date();
        if (access.expiresAt < now) {
            return NextResponse.json({ isElite: false, reason: 'EXPIRED' });
        }

        return NextResponse.json({
            isElite: true,
            tier: access.tier,
            expiresAt: access.expiresAt.toISOString()
        });
    } catch (e: any) {
        console.error("ELITE_CHECK_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
