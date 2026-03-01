import type { Metadata } from 'next';
import './globals.css';
import { SolanaProvider } from '@/components/SolanaProvider';
import { Providers } from './providers';
import { validateEnv } from '@/lib/server/env';
import { GlobalNotification } from '@/components/GlobalNotification';

// Verify production environment stability
validateEnv();

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    title: 'VORTEX | Industrial Solana DEX Screener',
    description: 'High-precision real-time Solana token analytics, security audits, and specialized swap execution via Jupiter V6.',
    keywords: ['Solana', 'DEX Screener', 'Jupiter', 'Swap', 'Token Audit', 'Vortex'],
    openGraph: {
        title: 'VORTEX | Hyper-Visual Solana Recon',
        description: 'Elite-grade DEX screener with industrial futurism aesthetics.',
        images: ['/og-image.png'],
    },
    icons: {
        icon: '/favicon.ico',
    }
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="hud-flicker" suppressHydrationWarning>
                <div className="vortex-scanlines"></div>
                <Providers>
                    <SolanaProvider>
                        {children}
                        <GlobalNotification />
                    </SolanaProvider>
                </Providers>
            </body>
        </html>
    );
}
