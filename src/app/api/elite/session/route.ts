import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createSession } from '@/lib/server/session.mjs';
import { eliteAccessUntil } from '@/lib/server/elite';

const SESSION_MS = 24 * 3_600_000;

/** Exchanges a signed message from an Elite wallet for a 24-hour research token. */
export async function POST(request: NextRequest) {
    try {
        const { wallet, signature, timestamp } = await request.json();
        if (typeof wallet !== 'string' || typeof signature !== 'string' || !Number.isFinite(timestamp))
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        if (Math.abs(Date.now() - timestamp) > 300_000) return NextResponse.json({ error: 'SIGNATURE_EXPIRED' }, { status: 401 });
        let valid = false;
        try {
            valid = nacl.sign.detached.verify(new TextEncoder().encode(`VORTEX_ELITE_SESSION:${wallet}:${timestamp}`), bs58.decode(signature), new PublicKey(wallet).toBytes());
        } catch { valid = false; }
        if (!valid) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });

        const until = await eliteAccessUntil(wallet);
        if (!until) return NextResponse.json({ error: 'ELITE_REQUIRED' }, { status: 402 });
        const expiresAt = new Date(Math.min(until.getTime(), Date.now() + SESSION_MS));
        return NextResponse.json({ token: createSession(wallet, expiresAt, process.env.VORTEX_JWT_SECRET), expiresAt: expiresAt.toISOString() });
    } catch (error) {
        console.error('ELITE_SESSION_ERROR', error);
        return NextResponse.json({ error: 'SESSION_UNAVAILABLE' }, { status: 503 });
    }
}
