import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '@/lib/prisma';
import { PROTECTED_MINT_ADDRESSES } from '@/lib/constants';

export async function POST(request: NextRequest) {
    try {
        const { address, wallet, signature, timestamp } = await request.json();
        const now = Date.now();

        if (!address || !wallet || !signature || !timestamp) {
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        }

        // 0. Anti-Replay: Verify timestamp is within 5 minutes
        const timestampNum = Number(timestamp);
        if (isNaN(timestampNum) || Math.abs(now - timestampNum) > 300000) {
            return NextResponse.json({ error: 'TIMEOUT_EXPIRED' }, { status: 401 });
        }

        // Sanity Check Solana Addresses
        try {
            new PublicKey(address);
            new PublicKey(wallet);
        } catch {
            return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
        }

        if (PROTECTED_MINT_ADDRESSES.includes(address)) {
            return NextResponse.json({ error: 'CANNOT_CLAIM_PROTECTED_ASSET' }, { status: 403 });
        }

        // 1. Verify Signature (use the original string/number exact value passed by client)
        const message = `VORTEX_CLAIM::${address}::${wallet}::${timestamp}`;
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = new PublicKey(wallet).toBytes();

        const isValid = nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
        );

        if (!isValid) {
            return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
        }

        // 2. Prevent Overwriting Existing Owners
        const existing = await prisma.enhancement.findUnique({ where: { address } });

        if (existing?.owner && existing.owner !== wallet) {
            return NextResponse.json({ error: 'ASSET_ALREADY_CLAIMED' }, { status: 403 });
        }

        // 3. Persist Claim
        await prisma.enhancement.upsert({
            where: { address },
            update: { owner: wallet },
            create: {
                address,
                owner: wallet,
                tier: 'Basic'
            }
        });

        // Log the claim event
        await prisma.claim.create({
            data: {
                address,
                wallet,
                signature,
                timestamp: new Date(timestampNum)
            }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("API_CLAIM_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { address, wallet, signature, timestamp, metadata } = await request.json();
        const now = Date.now();

        if (!address || !wallet || !signature || !timestamp || !metadata) {
            return NextResponse.json({ error: 'MISSING_PARAMETERS' }, { status: 400 });
        }

        const timestampNum = Number(timestamp);
        if (isNaN(timestampNum) || Math.abs(now - timestampNum) > 300000) {
            return NextResponse.json({ error: 'TIMEOUT_EXPIRED' }, { status: 401 });
        }

        const message = `VORTEX_UPDATE::${address}::${wallet}::${timestamp}`;
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = new PublicKey(wallet).toBytes();

        const isValid = nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
        );

        if (!isValid) {
            return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
        }

        const existing = await prisma.enhancement.findUnique({ where: { address } });

        if (!existing || existing.owner !== wallet) {
            return NextResponse.json({ error: 'UNAUTHORIZED_OWNER' }, { status: 403 });
        }

        await prisma.enhancement.update({
            where: { address },
            data: {
                socials: metadata.socials || existing.socials,
                customDescription: metadata.customDescription || existing.customDescription
            }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("API_UPDATE_ERROR:", e);
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
