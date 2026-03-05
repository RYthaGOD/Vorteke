import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        // Fetch all tokens that have purchased enhancement (Enhanced or Elite)
        const enhancements = await prisma.enhancement.findMany({
            where: {
                tier: { in: ['Enhanced', 'Elite'] }
            },
            select: {
                address: true
            }
        });

        const addresses = enhancements.map(e => e.address);
        return NextResponse.json(addresses);
    } catch (error: any) {
        console.error('VERIFIED_LIST_FETCH_ERROR:', error);
        return NextResponse.json({ error: 'FAILED_TO_FETCH_ENHANCEMENT_LIST' }, { status: 500 });
    }
}
