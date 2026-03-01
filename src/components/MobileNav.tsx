'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, LayoutDashboard, Wallet, Zap } from 'lucide-react';

export function MobileNav() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <nav className="vortex-mobile-nav">
            <button
                onClick={() => router.push('/')}
                className={`mobile-nav-item ${pathname === '/' ? 'active' : ''}`}
            >
                <LayoutDashboard size={22} className="vortex-mb-1" />
                <span>HUB</span>
            </button>
            <button
                onClick={() => {
                    if (pathname !== '/') {
                        router.push('/?focusSearch=true');
                    } else {
                        document.querySelector<HTMLInputElement>('.vortex-search-input-pl')?.focus();
                    }
                }}
                className="mobile-nav-item"
            >
                <Search size={22} className="vortex-mb-1" />
                <span>SCAN</span>
            </button>
            <button
                className="mobile-nav-item"
                onClick={() => router.push('/?tab=portfolio')}
            >
                <Wallet size={22} className="vortex-mb-1" />
                <span>ASSETS</span>
            </button>
            <button
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
                <Zap size={22} className="vortex-mb-1" />
                <span>ELITE</span>
            </button>
        </nav>
    );
}
