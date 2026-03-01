import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path) {
        return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    try {
        const baseUrl = 'https://api.geckoterminal.com/api/v2';
        // Clean the path (remove leading slash if present)
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;

        // Construct target URL with other search params
        const targetUrl = new URL(`${baseUrl}/${cleanPath}`);
        searchParams.forEach((value, key) => {
            if (key !== 'path') {
                targetUrl.searchParams.append(key, value);
            }
        });

        const response = await fetch(targetUrl.toString(), {
            headers: {
                'Accept': 'application/json'
            },
            next: { revalidate: 60 } // Cache for 1 minute
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(errorData, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('GECKO_PROXY_ERROR:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
