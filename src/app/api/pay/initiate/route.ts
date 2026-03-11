import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TREASURY_ENHANCEMENTS, RPC_ENDPOINTS } from '@/lib/constants';
import { getResilientConnection } from '@/lib/solana/connection';

export async function POST(request: NextRequest) {
    try {
        const { wallet, amount, address, tier } = await request.json();

        if (!wallet || (typeof amount !== 'number') || !address || !tier) {
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        }

        // FIX: Validate tier against allowlist to prevent spoofed values
        const VALID_TIERS = ['Enhanced', 'Elite', 'DeepScan'];
        if (!VALID_TIERS.includes(tier)) {
            return NextResponse.json({ error: 'INVALID_TIER' }, { status: 400 });
        }

        try {
            new PublicKey(wallet);
            new PublicKey(address);
        } catch {
            return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
        }

        const { blockhash } = await getResilientConnection(c => c.getLatestBlockhash());
        const fromPubkey = new PublicKey(wallet);
        const transaction = new Transaction();

        const toPubkey = new PublicKey(TREASURY_ENHANCEMENTS);
        transaction.add(
            SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: Math.floor(amount),
            })
        );

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        return NextResponse.json({
            transaction: serializedTransaction.toString('base64'),
            message: `VORTEX_UPGRADE::${address}::${tier}::SOL_PAY`
        });
    } catch (e: any) {
        console.error("PAYMENT_INIT_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
