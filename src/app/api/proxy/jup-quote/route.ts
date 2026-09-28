import { NextRequest, NextResponse } from 'next/server';
const mint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export async function GET(req: NextRequest) {
    const p = req.nextUrl.searchParams;
    const inputMint = p.get('inputMint') || '', outputMint = p.get('outputMint') || '', amount = p.get('amount') || '';
    const slippage = Number(p.get('slippageBps') ?? '100');
    if (!mint.test(inputMint) || !mint.test(outputMint) || inputMint === outputMint || !/^[1-9]\d*$/.test(amount) || amount.length > 20 || !Number.isInteger(slippage) || slippage < 0 || slippage > 5000) {
        return NextResponse.json({ error: 'Check the tokens, amount, and slippage.' }, { status: 400 });
    }
    const key = process.env.JUPITER_API_KEY || process.env.NEXT_PUBLIC_JUPITER_API_KEY;
    try {
        const query = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippage), swapMode: 'ExactIn' });
        const response = await fetch('https://api.jup.ag/swap/v1/quote?' + query, {
            headers: key ? { 'x-api-key': key } : {}, cache: 'no-store', signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return NextResponse.json({ error: 'No quote available. Try again shortly.' }, { status: response.status === 429 ? 429 : 503 });
        return NextResponse.json(await response.json());
    } catch {
        return NextResponse.json({ error: 'The quote provider did not respond. Try again.' }, { status: 503 });
    }
}
