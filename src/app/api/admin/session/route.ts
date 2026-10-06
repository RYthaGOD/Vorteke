import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createSession } from '@/lib/server/session.mjs';
import { adminWallet } from '@/lib/server/admin';

const SESSION_MS = 8 * 3_600_000;

/** Signs the admin wallet in for 8 hours after it signs a fresh message. */
export async function POST(request: NextRequest) {
    try {
        const { wallet, signature, timestamp } = await request.json();
        if (!adminWallet() || wallet !== adminWallet()) return NextResponse.json({ error: 'NOT_ADMIN' }, { status: 403 });
        if (typeof signature !== 'string' || !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 300_000)
            return NextResponse.json({ error: 'SIGNATURE_EXPIRED' }, { status: 401 });
        let valid = false;
        try {
            valid = nacl.sign.detached.verify(new TextEncoder().encode(`VORTEX_ADMIN:${wallet}:${timestamp}`), bs58.decode(signature), new PublicKey(wallet).toBytes());
        } catch { valid = false; }
        if (!valid) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
        const expiresAt = new Date(Date.now() + SESSION_MS);
        return NextResponse.json({ token: createSession(wallet, expiresAt, process.env.VORTEX_JWT_SECRET, 'admin'), expiresAt: expiresAt.toISOString() });
    } catch (error) {
        console.error('ADMIN_SESSION_ERROR', error);
        return NextResponse.json({ error: 'SESSION_UNAVAILABLE' }, { status: 503 });
    }
}
