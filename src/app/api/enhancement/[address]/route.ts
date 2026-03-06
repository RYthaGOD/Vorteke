import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    const { address } = await params;

    try {
        new PublicKey(address);
    } catch {
        return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
    }

    try {
        const enhancement = await prisma.enhancement.findUnique({
            where: { address }
        });

        if (!enhancement) {
            return NextResponse.json({ address, tier: 'Basic' });
        }

        // Sanitize socials to avoid malformed JSON breaking the frontend
        const rawSocials = enhancement.socials as any || {};
        const sanitizedSocials = {
            twitter: typeof rawSocials.twitter === 'string' ? rawSocials.twitter : undefined,
            telegram: typeof rawSocials.telegram === 'string' ? rawSocials.telegram : undefined,
            website: typeof rawSocials.website === 'string' ? rawSocials.website : undefined,
        };

        return NextResponse.json({
            ...enhancement,
            socials: sanitizedSocials
        });
    } catch (e) {
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
