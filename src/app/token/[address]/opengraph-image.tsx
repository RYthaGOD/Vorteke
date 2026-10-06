import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'VORTEX token page';

function formatPrice(price: number) {
    if (!Number.isFinite(price) || price <= 0) return null;
    if (price >= 1) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return '$' + price.toPrecision(4);
}

/** Link preview for a token page: symbol, name and current price. */
export default async function Image({ params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    const token = await prisma.token.findUnique({ where: { address }, select: { name: true, symbol: true } }).catch(() => null);
    let price: string | null = null;
    try {
        const response = await fetch('https://api.jup.ag/price/v3?ids=' + encodeURIComponent(address), { signal: AbortSignal.timeout(4000), next: { revalidate: 300 } });
        if (response.ok) price = formatPrice(Number((await response.json())[address]?.usdPrice));
    } catch { /* price is optional */ }
    const symbol = token?.symbol || address.slice(0, 4) + '…' + address.slice(-4);

    return new ImageResponse(
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#07090c', color: '#f2f5f7', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', fontSize: 30, letterSpacing: 8, color: '#00e5ff' }}>VORTEX</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 112, fontWeight: 700 }}>{symbol.slice(0, 14)}</div>
                {token?.name && <div style={{ fontSize: 40, color: '#9aa4ad' }}>{token.name.slice(0, 40)}</div>}
                {price && <div style={{ fontSize: 64, marginTop: 24 }}>{price}</div>}
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: '#9aa4ad' }}>Solana market terminal · price, liquidity and holder scan</div>
        </div>,
        size,
    );
}
