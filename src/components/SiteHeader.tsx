'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ArrowUpRight, Search } from 'lucide-react';
import { SOLANA_NETWORK } from '@/lib/constants';

export function SiteHeader() {
    const pathname = usePathname();
    const router = useRouter();
    useEffect(() => {
        if (pathname === '/terminal') return;
        const search = (event: KeyboardEvent) => {
            if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]')) return;
            if (event.key === '/') { event.preventDefault(); router.push('/terminal?focusSearch=true'); }
        };
        window.addEventListener('keydown', search);
        return () => window.removeEventListener('keydown', search);
    }, [pathname, router]);
    return <header className="vortex-site-header">
        <a className="vortex-skip-link" href="#main-content">Skip to content</a>
        <Link className="vortex-wordmark" href="/" aria-label="VORTEX home">
            <Image className="vortex-brand-mark" src="/assets/vortex-logo.png" alt="" width={36} height={36} priority />
            VORTEX<span className="vortex-network">SOLANA{SOLANA_NETWORK === 'devnet' ? ' / DEVNET' : ''}</span>
        </Link>
        <nav aria-label="Main navigation">
            {[['/terminal', 'Markets'], ['/launches', 'New pairs'], ['/elite', 'Intelligence'], ['/#projects', 'For projects']].map(([href, label]) =>
                <Link key={href} href={href} aria-current={pathname === href || (href === '/terminal' && pathname.startsWith('/token')) ? 'page' : undefined}>{label}</Link>)}
        </nav>
        <div className="vortex-header-actions">
            <Link className="vortex-header-search" href="/terminal?focusSearch=true" aria-label="Search tokens"><Search size={16} aria-hidden /><span>Search tokens</span><kbd>/</kbd></Link>
            {pathname === '/' ? <Link className="btn-vortex btn-vortex-primary" href="/terminal">Open terminal <ArrowUpRight size={16} aria-hidden /></Link> : <WalletMultiButton className="vortex-wallet-btn" />}
        </div>
    </header>;
}
