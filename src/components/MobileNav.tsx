'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, LayoutDashboard, Wallet, Zap } from 'lucide-react';

export function MobileNav() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <nav className="vortex-mobile-nav" aria-label="Primary">
            <button
                type="button"
                onClick={() => router.push('/terminal')}
                className={`mobile-nav-item ${pathname === '/terminal' ? 'active' : ''}`}
                aria-current={pathname === '/terminal' ? 'page' : undefined}
            >
                <LayoutDashboard size={22} className="vortex-mb-1 vortex-tactical-icon" aria-hidden="true" />
                <span>Markets</span>
            </button>
            <button
                type="button"
                onClick={() => {
                    if (pathname !== '/terminal') {
                        router.push('/terminal?focusSearch=true');
                    } else {
                        document.querySelector<HTMLInputElement>('#market-search')?.focus();
                    }
                }}
                className="mobile-nav-item"
            >
                <Search size={22} className="vortex-mb-1 vortex-tactical-icon" aria-hidden="true" />
                <span>Search</span>
            </button>
            <button
                type="button"
                className="mobile-nav-item"
                onClick={() => router.push('/terminal?tab=portfolio')}
            >
                <Wallet size={22} className="vortex-mb-1 vortex-tactical-icon" aria-hidden="true" />
                <span>Portfolio</span>
            </button>
            <button
                type="button"
                className="mobile-nav-item"
                onClick={() => {
                    if (pathname.startsWith('/token/')) {
                        // In a real app, this would trigger the enhancement modal via an event bus or global state
                        window.dispatchEvent(new CustomEvent('VORTEX_SHOW_ENHANCE'));
                    } else {
                        router.push('/elite');
                    }
                }}
            >
                <Zap size={22} className="vortex-mb-1 vortex-tactical-icon" aria-hidden="true" />
                <span>Elite</span>
            </button>

        </nav>
    );
}
