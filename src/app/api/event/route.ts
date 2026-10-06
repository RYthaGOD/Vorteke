import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FUNNEL_EVENTS } from '@/lib/analytics';

/** Counts one funnel step for today. Only the step name is stored. */
export async function POST(request: NextRequest) {
    try {
        const { name } = await request.json();
        if (!FUNNEL_EVENTS.includes(name)) return new NextResponse(null, { status: 204 });
        const day = new Date().toISOString().slice(0, 10);
        await prisma.funnelEvent.upsert({
            where: { day_name: { day, name } },
            update: { count: { increment: 1 } },
            create: { day, name, count: 1 },
        });
    } catch { /* analytics never breaks a page */ }
    return new NextResponse(null, { status: 204 });
}
