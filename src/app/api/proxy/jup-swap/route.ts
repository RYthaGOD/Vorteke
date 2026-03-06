import { NextRequest, NextResponse } from 'next/server';

const JUPITER_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.quoteResponse || !body.userPublicKey) {
            return NextResponse.json({ error: 'Missing required swap parameters' }, { status: 400 });
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (JUPITER_API_KEY) {
            headers['x-api-key'] = JUPITER_API_KEY;
        }

        const response = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`JUPITER_SWAP_HTTP_${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('JUP_SWAP_PROXY_ERROR:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
