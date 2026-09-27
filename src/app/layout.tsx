import type { Metadata } from 'next';
import './globals.css';
import './revamp.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SolanaProvider } from '@/components/SolanaProvider';
import { Providers } from './providers';
import { validateEnv } from '@/lib/server/env';
import { GlobalNotification } from '@/components/GlobalNotification';

// Verify production environment stability
validateEnv();

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    title: 'VORTEX | Solana markets, in focus',
    description: 'Explore Solana token markets, inspect on-chain signals, and give your project a complete token profile.',
    keywords: ['Solana', 'DEX Screener', 'Jupiter', 'Swap', 'Token Audit', 'Vortex'],
    openGraph: {
        title: 'VORTEX | Hyper-Visual Solana Recon',
        description: 'Elite-grade DEX screener with industrial futurism aesthetics.',
        images: ['/og-image.png'],
    },
    icons: {
        icon: '/favicon.png',
        apple: '/favicon.png',
        shortcut: '/favicon.png',
    }
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body suppressHydrationWarning>
                {/* <div className="vortex-scanlines"></div> */}
                <Providers>
                    <SolanaProvider>
                        <SiteHeader />
                        {children}
                        <GlobalNotification />
                    </SolanaProvider>
                </Providers>
            </body>
        </html>
    );
}
