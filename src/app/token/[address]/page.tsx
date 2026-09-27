import { Metadata } from 'next';
import TokenClientPage from '../TokenClientPage';

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
    const { address } = await params;

    // We try to resolve basic token metadata for the OpenGraph card
    let displayName = `${address.slice(0, 4)}...${address.slice(-4)}`;
    let symbol = '';

    // VORTEX_SOVEREIGN_RECON: Fetch real token metadata from DB for perfect SEO
    try {
        const { prisma } = await import('@/lib/prisma');
        const token = await prisma.token.findUnique({ where: { address } });
        const enhancement = await prisma.enhancement.findUnique({ where: { address } });

        if (token) {
            displayName = token.name || displayName;
            symbol = token.symbol || '';
        }
        
        // Add dynamic OG image if available
        if (enhancement?.iconURI || token?.logoURI) {
            // We can pass this to OG images later
        }
    } catch (e) {
        console.warn("SSR_METADATA_FETCH_FAILED", e);
    }

    const title = `VORTEX | ${displayName} ${symbol ? `(${symbol})` : ''} - Live Intelligence`;
    const description = `Intercept whale telemetry, audit bundle risk, and execute accelerated swaps for ${displayName} on the Vortex Network.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: [
                {
                    url: `/og-image.png`,
                    width: 1200,
                    height: 630,
                    alt: `Vortex Recon: ${displayName}`,
                }
            ]
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`/og-image.png`],
        }
    };
}

export default async function Page({ params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    return <TokenClientPage address={address} />;
}
