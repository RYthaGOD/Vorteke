import { NextRequest } from 'next/server';
import { streamingService } from '@/lib/vortex/streamingService';

/**
 * VORTEX_STREAM_ROUTE: Server-Sent Events (SSE) Handler
 * Provides a persistent, low-latency tactical data bridge from server to UI.
 * Eliminates the need for aggressive client-side polling.
 */
export async function GET(req: NextRequest) {
    const address = req.nextUrl.searchParams.get('address');
    const isDiscovery = req.nextUrl.searchParams.get('discovery') === 'true';

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const writeEvent = async (event: string, data: any) => {
        try {
            await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
            // Stream closed
        }
    };

    // Keep-alive heartbeat (Industrial Stability)
    const heartbeat = setInterval(() => {
        writeEvent('heartbeat', { ts: Date.now() });
    }, 15000);

    // Dynamic Tactical Routing
    const txHandler = (tx: any) => writeEvent('tx', tx);
    const discoveryHandler = (update: any) => writeEvent('discovery', update);

    if (address) {
        await streamingService.trackToken(address);
        streamingService.on(`tx:${address}`, txHandler);
    }

    if (isDiscovery) {
        streamingService.on('discovery:pulse', discoveryHandler);
    }

    // Cleanup logic when client disconnects
    req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        if (address) {
            streamingService.off(`tx:${address}`, txHandler);
            streamingService.untrackToken(address);
        }
        if (isDiscovery) streamingService.off('discovery:pulse', discoveryHandler);
        writer.close();
    });

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Critical for Nginx/Vercel/Railway proxies
        },
    });
}
