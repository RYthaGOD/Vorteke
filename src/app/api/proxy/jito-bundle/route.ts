import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { signedTransaction } = await req.json();

        if (!signedTransaction) {
            return NextResponse.json({ error: 'Missing signed transaction' }, { status: 400 });
        }

        // Jito Block Engine Mainnet Endpoint
        const JITO_URL = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles';

        const response = await fetch(JITO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "sendBundle",
                params: [[signedTransaction]]
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`JITO_BUNDLE_HTTP_${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('JITO_BUNDLE_PROXY_ERROR:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
