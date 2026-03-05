import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { TREASURY_ENHANCEMENTS, RPC_ENDPOINTS } from '@/lib/constants';

export const maxDuration = 60; // Prevent Vercel 10-second serverless timeout during RPC congestion

// In-Memory Rate Limiter (Fallback for Serverless/Edge before Upstash Redis)
const RATE_LIMIT_MAP = new Map<string, { count: number, resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 15;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute

    if (!RATE_LIMIT_MAP.has(ip)) {
        RATE_LIMIT_MAP.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }

    const record = RATE_LIMIT_MAP.get(ip)!;
    if (now > record.resetTime) {
        RATE_LIMIT_MAP.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (record.count >= MAX_REQUESTS_PER_MINUTE) {
        return false;
    }

    record.count += 1;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        const { signature, address, tier, wallet, isVtx } = await request.json();

        if (!signature || !address || !tier || !wallet) {
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        }

        // Apply Layer-7 DDoS Defense (Rate Limiting)
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (!checkRateLimit(ip)) {
            console.warn(`RATE_LIMIT_BREACH: IP [${ip}] blocked from payment verification endpoint.`);
            return NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 });
        }

        const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_PRIMARY || RPC_ENDPOINTS[0];
        const connection = new Connection(endpoint, 'confirmed');

        // 0. Anti-Double-Spend Check (CRITICAL)
        const existingPayment = await prisma.enhancement.findFirst({
            where: { lastPaymentTx: signature }
        });

        if (existingPayment) {
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

        // 2. Validate Payment (SOL Transfer or VTX Burn)
        if (isVtx) {
            // BURN VERIFICATION PROTOCOL
            const vtxMint = process.env.NEXT_PUBLIC_VTX_MINT;
            if (!vtxMint) return NextResponse.json({ error: 'VTX_MINT_UNCONFIGURED' }, { status: 500 });

            // Check post-token balances to verify a reduction (Burn)
            const preTokenBalance = tx.meta?.preTokenBalances?.find(b => b.mint === vtxMint && b.owner === wallet);
            const postTokenBalance = tx.meta?.postTokenBalances?.find(b => b.mint === vtxMint && b.owner === wallet);

            if (!preTokenBalance || !postTokenBalance) {
                return NextResponse.json({ error: 'BURN_DATA_NOT_FOUND' }, { status: 403 });
            }

            const burnedAmount = BigInt(preTokenBalance.uiTokenAmount.amount) - BigInt(postTokenBalance.uiTokenAmount.amount);

            // Calculate expected burn amount (50% discount)
            const usdcAmount = tier === 'Elite' ? 120 : 30;
            const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            const usdcLamports = (usdcAmount * 0.5) * 1_000_000;

            const quoteReq = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${usdcMint}&outputMint=${vtxMint}&amount=${usdcLamports}&slippageBps=100`);
            const quoteRes = await quoteReq.json();

            if (!quoteRes || !quoteRes.outAmount) {
                return NextResponse.json({ error: 'ORACLE_UNAVAILABLE' }, { status: 503 });
            }

            const expectedAtoms = BigInt(quoteRes.outAmount);

            // Allow 5% buffer for slippage and oracle drift
            if (burnedAmount < (expectedAtoms * BigInt(95)) / BigInt(100)) {
                return NextResponse.json({
                    error: 'INSUFFICIENT_BURN',
                    expected: expectedAtoms.toString(),
                    received: burnedAmount.toString()
                }, { status: 403 });
            }
        } else {
            // SOL TRANSFER VERIFICATION
            const treasuryKey = new PublicKey(TREASURY_ENHANCEMENTS);
            let expectedLamports = 0;

            if (tier === 'DeepScan') {
                expectedLamports = 0.02 * 1_000_000_000;
            } else {
                const usdcAmount = tier === 'Elite' ? 120 : 30;
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

            const treasuryIndex = tx.transaction.message.staticAccountKeys.findIndex(k => k.equals(treasuryKey));
            if (treasuryIndex === -1) {
                return NextResponse.json({ error: 'INVALID_RECIPIENT' }, { status: 403 });
            }

            const receivedLamports = (tx.meta?.postBalances[treasuryIndex] || 0) - (tx.meta?.preBalances[treasuryIndex] || 0);

            if (receivedLamports < expectedLamports * 0.95) {
                return NextResponse.json({ error: 'INSUFFICIENT_PAYMENT' }, { status: 403 });
            }
        }

        // 3. Update Global Database
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
