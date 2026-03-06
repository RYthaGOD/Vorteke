import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createBurnInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { TREASURY_ENHANCEMENTS, RPC_ENDPOINTS, VTX_MINT } from '@/lib/constants';
import { getResilientConnection } from '@/lib/solana/connection';

export async function POST(request: NextRequest) {
    try {
        const { wallet, amount, address, tier, isVtx } = await request.json();

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
            if (isVtx && VTX_MINT) new PublicKey(VTX_MINT);
        } catch {
            return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
        }

        // FIX: Use getResilientConnection instead of bare new Connection()
        const { blockhash } = await getResilientConnection(c => c.getLatestBlockhash());
        const fromPubkey = new PublicKey(wallet);
        const transaction = new Transaction();


        if (isVtx && VTX_MINT) {
            const mintPubkey = new PublicKey(VTX_MINT);
            let ata;
            try {
                ata = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
            } catch (ataErr) {
                return NextResponse.json({ error: 'VTX_ACCOUNT_NOT_FOUND', details: 'User does not have an active VTX token account.' }, { status: 400 });
            }

            // Burning VTX directly from the user's account
            transaction.add(
                createBurnInstruction(
                    ata,
                    mintPubkey,
                    fromPubkey,
                    BigInt(Math.floor(amount))
                )
            );
        } else {
            const toPubkey = new PublicKey(TREASURY_ENHANCEMENTS);
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey,
                    toPubkey,
                    lamports: Math.floor(amount), // Incoming amount is already in lamports from monetizationService
                })
            );
        }

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        return NextResponse.json({
            transaction: serializedTransaction.toString('base64'),
            message: `VORTEX_UPGRADE::${address}::${tier}::${isVtx ? 'VTX_BURN' : 'SOL_PAY'}`
        });
    } catch (e: any) {
        console.error("PAYMENT_INIT_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
