import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const wallet = searchParams.get('wallet');

        if (!wallet) {
            return NextResponse.json({ error: 'MISSING_WALLET' }, { status: 400 });
        }

        const access = await (prisma as any).testAccess.findUnique({
            where: { wallet }
        });

        if (!access) {
            return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            tier: access.tier,
            expiresAt: access.expiresAt.toISOString()
        });
    } catch (e: any) {
        console.error("GET_ACCESS_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { wallet, code, signature, timestamp } = await req.json();

        if (!wallet || !code || !signature || !timestamp) {
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        }

        // 1. Verify Signature (SIWS Lite)
        // Ensure string matches exactly what is signed in the frontend
        const message = `VORTEX_PROVISION_ACCESS:${wallet}:${timestamp}`;
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = Buffer.from(signature, 'base64');
        const walletBytes = new PublicKey(wallet).toBytes();

        const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, walletBytes);
        if (!isValid) {
            return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
        }

        // 2. Prevent Replay (5 minute window)
        const now = Date.now();
        if (Math.abs(now - timestamp) > 300000) {
            return NextResponse.json({ error: 'SIGNATURE_EXPIRED' }, { status: 401 });
        }

        if (code !== 'VORTEKE') {
            return NextResponse.json({ error: 'INVALID_ACCESS_CODE' }, { status: 403 });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const access = await (prisma as any).testAccess.upsert({
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
