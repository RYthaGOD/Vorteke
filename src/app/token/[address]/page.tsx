import { Metadata } from 'next';
import TokenClientPage from '../TokenClientPage';

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
    const { address } = await params;

    // We try to resolve basic token metadata for the OpenGraph card
    let displayName = `${address.slice(0, 4)}...${address.slice(-4)}`;
    let symbol = '';

    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
        const data = await res.json();
        if (data.pairs && data.pairs.length > 0) {
            const pair = data.pairs[0];
            displayName = pair.baseToken.name;
            symbol = pair.baseToken.symbol;
        }
    } catch {
        // Fallback to address if API fails during SSR
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
