import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TREASURY_ENHANCEMENTS } from '@/lib/constants';
import { getResilientConnection } from '@/lib/solana/connection';
import { MEMO_PROGRAM, validatePayment } from '@/lib/payments/validate.mjs';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const { signature, address, tier, wallet } = await request.json();
        if (typeof signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature) ||
            typeof address !== 'string' || typeof wallet !== 'string' || !['Enhanced', 'Elite', 'DeepScan'].includes(tier))
            return NextResponse.json({ error: 'INVALID_PAYMENT_REQUEST' }, { status: 400 });
        const receipt = await prisma.paymentReceipt.findUnique({ where: { signature }, include: { intent: true } });
        if (receipt) {
            const same = receipt.intent.wallet === wallet && receipt.intent.address === address && receipt.intent.tier === tier;
            return NextResponse.json(same ? { success: true, tier } : { error: 'TRANSACTION_ALREADY_CLAIMED' }, { status: same ? 200 : 409 });
        }
        const tx = await getResilientConnection(c => c.getParsedTransaction(signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 }));
        if (!tx) return NextResponse.json({ error: 'AWAITING_FINALIZATION' }, { status: 409 });
        const memo = tx.transaction.message.instructions.find(i => i.programId.toBase58() === MEMO_PROGRAM && 'parsed' in i);
        const reference = memo && 'parsed' in memo && typeof memo.parsed === 'string' ? memo.parsed : '';
        if (!reference.startsWith('VORTEX_PAY:')) return NextResponse.json({ error: 'INVALID_PAYMENT_REFERENCE' }, { status: 403 });
        const intent = await prisma.paymentIntent.findUnique({ where: { id: reference.slice('VORTEX_PAY:'.length) } });
        if (!intent || intent.wallet !== wallet || intent.address !== address || intent.tier !== tier)
            return NextResponse.json({ error: 'PAYMENT_DETAILS_MISMATCH' }, { status: 403 });
        const validationError = validatePayment(tx, intent, TREASURY_ENHANCEMENTS);
        if (validationError) return NextResponse.json({ error: validationError }, { status: 403 });
        await prisma.$transaction(async db => {
            // Unique receipt and entitlement commit together; ownership never comes from payment.
            await db.paymentReceipt.create({ data: { signature, intentId: intent.id } });
            if (tier === 'DeepScan') {
                await db.deepScanRecord.create({ data: { signature, address, wallet } });
            } else {
                const current = await db.enhancement.findUnique({ where: { address } });
                if (current?.owner !== wallet) throw new Error('PROFILE_OWNER_CHANGED');
                await db.enhancement.update({ where: { address }, data: {
                    tier: current.tier === 'Elite' ? 'Elite' : tier,
                    lastPaymentTx: signature, lastPaymentTime: new Date(),
                } });
            }
        });
        return NextResponse.json({ success: true, tier });
    } catch (error) {
        console.error('PAYMENT_VERIFY_ERROR', error);
        return NextResponse.json({ error: 'VERIFICATION_RETRY_REQUIRED' }, { status: 409 });
    }
}
