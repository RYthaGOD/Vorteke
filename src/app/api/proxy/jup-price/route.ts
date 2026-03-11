import { NextRequest, NextResponse } from 'next/server';

const JUPITER_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const ids = searchParams.get('ids');

        if (!ids) {
            return NextResponse.json({ error: 'Missing required price parameters (ids)' }, { status: 400 });
        }

        const url = `https://api.jup.ag/price/v2?ids=${ids}`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };

        if (JUPITER_API_KEY) {
            headers['x-api-key'] = JUPITER_API_KEY;
        }

        const response = await fetch(url, {
            headers,
            next: { revalidate: 5 } // Live Intelligence: Cache for only 5 seconds
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`JUPITER_PRICE_HTTP_${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('JUP_PRICE_PROXY_ERROR:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
