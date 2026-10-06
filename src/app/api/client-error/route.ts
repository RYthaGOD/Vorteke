import { NextRequest, NextResponse } from 'next/server';

const clip = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : undefined;

/** Receives browser errors reported by captureException and writes them to the server log. */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.error(JSON.stringify({
            level: 'CLIENT_ERROR',
            timestamp: new Date().toISOString(),
            message: clip(body?.message, 500),
            stack: clip(body?.stack, 2000),
            path: clip(body?.path, 200),
            context: body?.context && typeof body.context === 'object' ? JSON.stringify(body.context).slice(0, 1000) : undefined,
            userAgent: clip(request.headers.get('user-agent'), 200),
        }));
    } catch { /* malformed reports are ignored */ }
    return new NextResponse(null, { status: 204 });
}
