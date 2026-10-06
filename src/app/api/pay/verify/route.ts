import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TREASURY_ENHANCEMENTS } from '@/lib/constants';
import { getResilientConnection } from '@/lib/solana/connection';
import { MEMO_PROGRAM, validatePayment } from '@/lib/payments/validate.mjs';
import { PRODUCTS, PRODUCT_NAMES } from '@/lib/payments/pricing.mjs';
import { extendExpiry } from '@/lib/profiles.mjs';
import { sendAlert } from '@/lib/server/alert';

export const maxDuration = 60;

const HOUR_MS = 3_600_000;

export async function POST(request: NextRequest) {
    try {
        const { signature, address, tier, wallet } = await request.json();
        if (typeof signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature) ||
            typeof address !== 'string' || typeof wallet !== 'string' || !PRODUCT_NAMES.includes(tier))
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
        if (validationError) {
            // A finalized transaction tied to a real payment intent that still fails validation needs a human look.
            await sendAlert('Payment failed validation', { error: validationError, product: tier, wallet, address, signature });
            return NextResponse.json({ error: validationError }, { status: 403 });
        }
        const expiresAt = await prisma.$transaction(async db => {
            // Unique receipt and entitlement commit together; ownership never comes from payment.
            await db.paymentReceipt.create({ data: { signature, intentId: intent.id } });
            if (tier === 'EliteAccess') {
                const current = await db.eliteAccess.findUnique({ where: { wallet } });
                const until = extendExpiry(current?.expiresAt, PRODUCTS.EliteAccess.days * 24 * HOUR_MS);
                await db.eliteAccess.upsert({
                    where: { wallet },
                    update: { expiresAt: until, source: 'paid' },
                    create: { wallet, expiresAt: until, source: 'paid' },
                });
                return until;
            }
            const current = await db.enhancement.findUnique({ where: { address } });
            if (current?.owner !== wallet) throw new Error('PROFILE_OWNER_CHANGED');
            const paid = { lastPaymentTx: signature, lastPaymentTime: new Date() };
            if (tier === 'Boost') {
                const until = extendExpiry(current.boostExpiresAt, PRODUCTS.Boost.hours * HOUR_MS);
                await db.enhancement.update({ where: { address }, data: { ...paid, boostExpiresAt: until } });
                return until;
            }
            await db.enhancement.update({ where: { address }, data: { ...paid, tier: 'Enhanced' } });
            return null;
        });
        await sendAlert('Payment received', { product: tier, usd: intent.usdCents ? '$' + (intent.usdCents / 100).toFixed(2) : 'n/a', sol: intent.lamports / 1e9, wallet, address, signature });
        return NextResponse.json({ success: true, tier, expiresAt: expiresAt?.toISOString() ?? null });
    } catch (error) {
        console.error('PAYMENT_VERIFY_ERROR', error);
        await sendAlert('Payment verification error', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'VERIFICATION_RETRY_REQUIRED' }, { status: 409 });
    }
}
