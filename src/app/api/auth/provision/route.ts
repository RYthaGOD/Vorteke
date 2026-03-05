import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { wallet, code } = await req.json();

        if (!wallet || !code) {
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        }

        if (code !== 'VORTEKE') {
            return NextResponse.json({ error: 'INVALID_ACCESS_CODE' }, { status: 403 });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const access = await prisma.testAccess.upsert({
            where: { wallet },
            update: {
                tier: 'Elite',
                expiresAt,
            },
            create: {
                wallet,
                tier: 'Elite',
                expiresAt,
            },
        });

        return NextResponse.json({
            success: true,
            tier: access.tier,
            expiresAt: access.expiresAt.toISOString()
        });
    } catch (e: any) {
        console.error("PROVISION_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
