import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TREASURY_ENHANCEMENTS, RPC_ENDPOINTS } from '@/lib/constants';

export async function POST(request: NextRequest) {
    try {
        const { wallet, amount, address, tier } = await request.json();

        if (!wallet || !amount || !address || !tier) {
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        }

        // Sanity Check Solana Addresses
        try {
            new PublicKey(wallet);
            new PublicKey(address);
        } catch {
            return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
        }

        const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_PRIMARY || RPC_ENDPOINTS[0];
        const connection = new Connection(endpoint, 'confirmed');
        const fromPubkey = new PublicKey(wallet);
        const toPubkey = new PublicKey(TREASURY_ENHANCEMENTS);

        const { blockhash } = await connection.getLatestBlockhash();

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: Math.floor(amount * LAMPORTS_PER_SOL), // CRITICAL: Prevent Float-Crash
            })
        );

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        // Serialize the transaction for the frontend to sign
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        return NextResponse.json({
            transaction: serializedTransaction.toString('base64'),
            message: `VORTEX_UPGRADE::${address}::${tier}`
        });
    } catch (e: any) {
        console.error("PAYMENT_INIT_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
