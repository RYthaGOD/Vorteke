import { NextRequest, NextResponse } from 'next/server';

const DFLOW_API_KEY = process.env.DFLOW_API_KEY || '';
const DFLOW_API_URL = DFLOW_API_KEY ? 'https://quote-api.dflow.net/v1' : 'https://dev-quote-api.dflow.net/v1';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');
    const slippageBps = searchParams.get('slippageBps') || '50';
    const userPublicKey = searchParams.get('userPublicKey');

    if (!inputMint || !outputMint || !amount) {
        return NextResponse.json({ error: 'Missing required quote parameters' }, { status: 400 });
    }

    try {
        const query = new URLSearchParams({
            inputMint,
            outputMint,
            amount,
            slippageBps,
        });

        if (userPublicKey) query.append('userPublicKey', userPublicKey);

        const response = await fetch(`${DFLOW_API_URL}/quote?${query.toString()}`, {
            headers: DFLOW_API_KEY ? { 'x-api-key': DFLOW_API_KEY } : {},
            next: { revalidate: 0 }
        } as any);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DFLOW_QUOTE_HTTP_${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('DFLOW_QUOTE_PROXY_ERROR:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const response = await fetch(`${DFLOW_API_URL}/swap`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(DFLOW_API_KEY ? { 'x-api-key': DFLOW_API_KEY } : {})
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DFLOW_SWAP_HTTP_${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('DFLOW_SWAP_PROXY_ERROR:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
