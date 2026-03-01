import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { TREASURY_ENHANCEMENTS, RPC_ENDPOINTS } from '@/lib/constants';

export const maxDuration = 60; // Prevent Vercel 10-second serverless timeout during RPC congestion

export async function POST(request: NextRequest) {
    try {
        const { signature, address, tier, wallet } = await request.json();

        if (!signature || !address || !tier || !wallet) {
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        }

        const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_PRIMARY || RPC_ENDPOINTS[0];
        const connection = new Connection(endpoint, 'confirmed');

        // 0. Anti-Double-Spend Check (CRITICAL)
        // Ensure this transaction signature hasn't already been used to upgrade another token.
        const existingPayment = await prisma.enhancement.findFirst({
            where: { lastPaymentTx: signature }
        });

        if (existingPayment) {
            console.warn(`DOUBLE_SPEND_ATTEMPT_BLOCKED: Sig ${signature} already used for ${existingPayment.address}`);
            return NextResponse.json({ error: 'TRANSACTION_ALREADY_CLAIMED' }, { status: 403 });
        }

        // 1. Fetch and Verify Transaction
        const tx = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });

        if (!tx) {
            return NextResponse.json({ error: 'TRANSACTION_NOT_FOUND' }, { status: 404 });
        }

        // 2. Validate Recipient and Dynamic Amount
        const treasuryKey = new PublicKey(TREASURY_ENHANCEMENTS);
        let expectedLamports = 0;

        if (tier === 'DeepScan') {
            expectedLamports = 0.02 * 1_000_000_000; // Fixed 0.02 SOL for DeepScan
        } else {
            const usdcAmount = tier === 'Elite' ? 120 : 30;

            // Fetch LIVE quote to verify they paid enough SOL for the USD tier at roughly this moment
            const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            const solMint = 'So11111111111111111111111111111111111111112';
            const usdcLamports = usdcAmount * 1_000_000;

            const quoteReq = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${usdcMint}&outputMint=${solMint}&amount=${usdcLamports}&slippageBps=50`);
            const quoteRes = await quoteReq.json();

            if (!quoteRes || !quoteRes.outAmount) {
                return NextResponse.json({ error: 'ORACLE_UNAVAILABLE' }, { status: 503 });
            }

            expectedLamports = Number(quoteRes.outAmount);
        }

        const treasuryIndex = tx.transaction.message.staticAccountKeys
            ? tx.transaction.message.staticAccountKeys.findIndex(k => k.equals(treasuryKey))
            : -1;

        if (treasuryIndex === -1) {
            return NextResponse.json({ error: 'INVALID_RECIPIENT' }, { status: 403 });
        }

        const preBalance = tx.meta?.preBalances[treasuryIndex] || 0;
        const postBalance = tx.meta?.postBalances[treasuryIndex] || 0;
        const receivedLamports = postBalance - preBalance;

        // 5% Buffer (0.95) to account for high-congestion Phantom/Solflare behavior
        // where wallets auto-deduct Priority Fees from the *transfer amount* rather than 
        // the remaining wallet balance if the user presses "Max", preventing false-negatives.
        if (receivedLamports < expectedLamports * 0.95) {
            return NextResponse.json({
                error: 'INSUFFICIENT_PAYMENT',
                expected: expectedLamports,
                received: receivedLamports
            }, { status: 403 });
        }

        // 3. Update Global Database (Only for Token Upgrades)
        if (tier !== 'DeepScan') {
            await prisma.enhancement.upsert({
                where: { address },
                update: {
                    tier,
                    owner: wallet,
                    lastPaymentTx: signature,
                    lastPaymentTime: new Date()
                },
                create: {
                    address,
                    tier,
                    owner: wallet,
                    lastPaymentTx: signature,
                    lastPaymentTime: new Date()
                }
            });
        }

        return NextResponse.json({ success: true, tier });
    } catch (e: any) {
        console.error("PAYMENT_VERIFY_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
