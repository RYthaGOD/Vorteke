'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, LayoutDashboard, Wallet, Zap } from 'lucide-react';
export function MobileNav() {
    const router = useRouter();
    const pathname = usePathname();
    return <nav className="vortex-mobile-nav" aria-label="Mobile navigation">
        <Link href="/terminal" className={'mobile-nav-item ' + (pathname === '/terminal' || pathname.startsWith('/token') ? 'active' : '')} aria-current={pathname === '/terminal' ? 'page' : undefined}><LayoutDashboard size={20} aria-hidden /><span>Markets</span></Link>
        <button type="button" className="mobile-nav-item" onClick={() => {
            if (pathname !== '/terminal') router.push('/terminal?focusSearch=true');
            else { const input = document.querySelector<HTMLInputElement>('#market-search'); input?.scrollIntoView({ block: 'center' }); input?.focus(); }
        }}><Search size={20} aria-hidden /><span>Search</span></button>
        <Link className="mobile-nav-item" href="/terminal?tab=portfolio"><Wallet size={20} aria-hidden /><span>Portfolio</span></Link>
        <Link className={'mobile-nav-item ' + (pathname === '/elite' ? 'active' : '')} href="/elite" aria-current={pathname === '/elite' ? 'page' : undefined}><Zap size={20} aria-hidden /><span>Intelligence</span></Link>
    </nav>;
}
