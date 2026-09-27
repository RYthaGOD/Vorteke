import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TREASURY_ENHANCEMENTS, TIER_PRICES_SOL } from '@/lib/constants';
import { getResilientConnection } from '@/lib/solana/connection';
import { prisma } from '@/lib/prisma';
import { MEMO_PROGRAM } from '@/lib/payments/validate.mjs';

export async function POST(request: NextRequest) {
    try {
        const { wallet, address, tier } = await request.json();
        if (typeof wallet !== 'string' || typeof address !== 'string' || !['Enhanced', 'Elite', 'DeepScan'].includes(tier))
            return NextResponse.json({ error: 'INVALID_PAYMENT_REQUEST' }, { status: 400 });
        try { new PublicKey(wallet); new PublicKey(address); } catch {
            return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
        }
        if (tier !== 'DeepScan') {
            const profile = await prisma.enhancement.findUnique({ where: { address } });
            if (profile?.owner !== wallet) return NextResponse.json({ error: 'CLAIM_PROJECT_FIRST' }, { status: 403 });
        }
        const lamports = Math.round(TIER_PRICES_SOL[tier] * 1e9);
        const { blockhash } = await getResilientConnection(c => c.getLatestBlockhash());
        const intent = await prisma.paymentIntent.create({ data: {
            wallet, address, tier, lamports, expiresAt: new Date(Date.now() + 10 * 60_000),
        } });
        const fromPubkey = new PublicKey(wallet);
        const transaction = new Transaction({ recentBlockhash: blockhash, feePayer: fromPubkey }).add(
            SystemProgram.transfer({ fromPubkey, toPubkey: new PublicKey(TREASURY_ENHANCEMENTS), lamports }),
            new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [], data: Buffer.from('VORTEX_PAY:' + intent.id) }),
        );
        return NextResponse.json({ transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'), lamports, intentId: intent.id });
    } catch (error) {
        console.error('PAYMENT_INIT_ERROR', error);
        return NextResponse.json({ error: 'PAYMENT_UNAVAILABLE' }, { status: 503 });
    }
}
