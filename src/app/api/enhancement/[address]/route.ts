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

        // Default system enhancements could be merged here in the future
        return NextResponse.json(enhancement || { address, tier: 'Basic' });
    } catch (e) {
        return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
    }
}
