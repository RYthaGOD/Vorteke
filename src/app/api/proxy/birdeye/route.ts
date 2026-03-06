import { NextRequest, NextResponse } from 'next/server';

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const type = searchParams.get('type') || '1m';
    const time_from = searchParams.get('time_from');
    const time_to = searchParams.get('time_to');

    if (!address || !time_from || !time_to) {
        return NextResponse.json({ error: 'Missing required chart parameters' }, { status: 400 });
    }

    try {
        // v3 endpoint per Birdeye docs
        const targetUrl = `https://public-api.birdeye.so/defi/v3/token/ohlcv?address=${address}&type=${type}&time_from=${time_from}&time_to=${time_to}`;

        const response = await fetch(targetUrl, {
            headers: {
                'X-API-KEY': BIRDEYE_API_KEY,
                'x-chain': 'solana',
                'Accept': 'application/json'
            },
            next: { revalidate: 60 } // Standard 1 min cache to avoid rate limits
        } as any);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`BIRDEYE_HTTP_${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('BIRDEYE_PROXY_ERROR:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
