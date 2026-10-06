import { Metadata } from 'next';
import TokenClientPage from '../TokenClientPage';

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
    const { address } = await params;

    // We try to resolve basic token metadata for the OpenGraph card
    let displayName = `${address.slice(0, 4)}...${address.slice(-4)}`;
    let symbol = '';

    // Name and symbol come from the server-side token record, never from browser input.
    try {
        const { prisma } = await import('@/lib/prisma');
        const token = await prisma.token.findUnique({ where: { address }, select: { name: true, symbol: true } });
        if (token) {
            displayName = token.name || displayName;
            symbol = token.symbol || '';
        }
    } catch (e) {
        console.warn("SSR_METADATA_FETCH_FAILED", e);
    }

    const title = `${symbol || displayName} price, chart and holders | VORTEX`;
    const description = `Live ${displayName}${symbol ? ' (' + symbol + ')' : ''} price, liquidity, holder scan and swaps on Solana.`;

    // The preview image comes from opengraph-image.tsx next to this page.
    return {
        title,
        description,
        openGraph: { title, description, type: 'website' },
        twitter: { card: 'summary_large_image', title, description },
    };
}

export default async function Page({ params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    return <TokenClientPage address={address} />;
}
