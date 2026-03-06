import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');
    const slippageBps = searchParams.get('slippageBps') || '50';
    const swapMode = searchParams.get('swapMode') || 'ExactIn';

    if (!inputMint || !outputMint || !amount) {
        return NextResponse.json({ error: 'Missing required quote parameters' }, { status: 400 });
    }

    try {
        const jupUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&swapMode=${swapMode}`;

        const response = await fetch(jupUrl, {
            next: { revalidate: 0 }
        } as any);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`JUPITER_QUOTE_HTTP_${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('JUP_QUOTE_PROXY_ERROR:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
