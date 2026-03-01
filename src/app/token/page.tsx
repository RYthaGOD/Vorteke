import { Metadata, ResolvingMetadata } from 'next';
import TokenClientPage from './TokenClientPage';
import { fetchTokenData } from '@/lib/dataService';

interface PageProps {
    params: Promise<any>;
    searchParams: Promise<any>;
}

export async function generateMetadata(
    { searchParams }: PageProps,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const params = await searchParams;
    const address = Array.isArray(params.address) ? params.address[0] : params.address || 'JUPyiwrYPRnK3B9kR4A9p7YQ8vLwK2qNCjY7MkW99Ld';

    try {
        const token = await fetchTokenData(address);
        if (!token) throw new Error('Token not found');

        const previousImages = (await parent).openGraph?.images || [];

        return {
            title: `${token.symbol} (${token.name}) | VORTEX Tactical Screener`,
            description: `Tactical analysis for ${token.name} (${token.symbol}) on Solana. FDV: $${token.fdv.toLocaleString()}, Liquidity: $${token.liquidityUsd.toLocaleString()}. Advanced bundle detection and smart money flow.`,
            openGraph: {
                title: `${token.symbol} VORTEX Breakdown`,
                description: `High-precision analytics for ${token.address}.`,
                images: ['/vortex-logomark.png', ...previousImages],
            },
            twitter: {
                card: 'summary_large_image',
                title: `${token.symbol} Tactical Intel`,
                description: `Real-time Solana DEX analytics via VORTEX.`,
            }
        };
    } catch (e) {
        return {
            title: 'VORTEX | Tactical Token Analysis',
            description: 'The premier industrial-grade DEX screener for Solana.',
        };
    }
}

export default async function TokenPage(props: PageProps) {
    // NOTE: This route is now a legacy fallback for /token?address=...
    // Dynamic segments at /token/[address] are the preferred routing standard.
    await props.searchParams;
    return <TokenClientPage />;
}
