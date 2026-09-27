'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ArrowUpRight } from 'lucide-react';
import { SOLANA_NETWORK } from '@/lib/constants';

export function SiteHeader() {
    const pathname = usePathname();
    return <header className="vortex-site-header">
        <Link className="vortex-wordmark" href="/" aria-label="VORTEX home"><span aria-hidden>V</span>VORTEX<span className="vortex-network">SOLANA{SOLANA_NETWORK === 'devnet' ? ' / DEVNET' : ''}</span></Link>
        <nav aria-label="Main navigation">
            {[['/terminal', 'Markets'], ['/launches', 'New pairs'], ['/elite', 'Intelligence'], ['/#projects', 'For projects']].map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
        </nav>
        {pathname === '/' ? <Link className="btn-vortex btn-vortex-primary" href="/terminal">Open terminal <ArrowUpRight size={16} aria-hidden /></Link> : <WalletMultiButton className="vortex-wallet-btn" />}
    </header>;
}
