import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Issues a free-tier API key. No email verification, no billing hookup —
 * this is dev-signup only until a real signup/billing flow exists.
 */
export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'API_PREVIEW_NOT_AVAILABLE' }, { status: 404 });
    }
    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
    }

    const apiKey = await prisma.apiKey.create({
        data: { email, tier: 'free' },
    });

    return NextResponse.json({
        apiKey: apiKey.key,
        tier: apiKey.tier,
        monthlyRequestLimit: 50_000,
    }, { status: 201 });
}
