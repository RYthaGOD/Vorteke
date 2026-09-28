import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.quoteResponse || typeof body.userPublicKey !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.userPublicKey)) {
            return NextResponse.json({ error: 'Missing required swap parameters.' }, { status: 400 });
        }
        const key = process.env.JUPITER_API_KEY || process.env.NEXT_PUBLIC_JUPITER_API_KEY;
        const response = await fetch('https://api.jup.ag/swap/v1/swap', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
            body: JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: 'no-store',
        });
        if (!response.ok) return NextResponse.json({ error: 'Could not prepare the swap. Refresh the quote and retry.' }, { status: 503 });
        return NextResponse.json(await response.json());
    } catch {
        return NextResponse.json({ error: 'Could not prepare the swap. Try again shortly.' }, { status: 503 });
    }
}
