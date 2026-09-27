'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Rocket, Clock, ShieldCheck, ArrowRight, Activity, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { VortexLogo, VortexPanel, VortexButton } from '@/components/DesignSystem';
import { MobileNav } from '@/components/MobileNav';
import { formatCurrency, formatCompact } from '@/lib/dataService';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function NewLaunchesPage() {
    const router = useRouter();
    const { connected } = useVortexAuth();
    const [mounted, setMounted] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');

    useEffect(() => {
        setMounted(true);
    }, []);

    const { data: launches = [], isLoading, isError, isRefetching, refetch } = useQuery({
        queryKey: ['new_launches'],
        queryFn: async () => {
            const res = await fetch('/api/launches');
            if (!res.ok) throw new Error('Failed to fetch launches');
            return res.json();
        },
        refetchInterval: 15000, // Refresh every 15s for new drops
    });

    // Time Ago formatter
    const getTimeAgo = (dateStr: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    const filteredLaunches = launches.filter((l: any) => 
        l.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
        l.address.toLowerCase().includes(searchFilter.toLowerCase())
    );

    return (
        <main className="app-container">
            <div className="vortex-container-centered">
                {/* Standard Vortex Header */}
                <header className="vortex-header">
                    <div className="brand-section vortex-flex-start vortex-gap-4">
                        <div onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
                            <VortexLogo size="mini" />
                        </div>
                        <div className="vortex-flex-column">
                            <div className="vortex-logo-text glitch-text">VORTEX</div>
                            <span className="vortex-tagline text-vortex-cyan">Launchpad Radar.</span>
                        </div>
                    </div>

                    <nav className="nav-cluster">
                        <button className="nav-item vortex-glitch-hover" onClick={() => router.push('/terminal')}>
                            Screener
                        </button>
                        <button className="nav-item active vortex-glitch-hover">
                            Launches
                        </button>
                        <button className="nav-item vortex-glitch-hover" onClick={() => router.push('/elite')}>
                            Elite Analytics
                        </button>
                    </nav>
                    <div className="header-actions">
                        {mounted ? <WalletMultiButton className="vortex-wallet-btn" /> : <div className="btn-vortex btn-vortex-primary vortex-opacity-50">INITIALIZING...</div>}
                    </div>
                </header>
            </div>

            <div className="vortex-container-centered vortex-mt-6 animate-stagger">
                {/* Hero / Filter Section */}
                <VortexPanel title="New pairs" subTitle="Solana pools" glowColor="cyan" className="vortex-mb-6">
                    <div className="vortex-flex-between vortex-wrap vortex-gap-4">
                        <div className="vortex-flex-column">
                            <p className="vortex-text-sm vortex-text-muted vortex-m-0">
                                Monitoring global liquidity injections across Solana DEXs in real-time.
                            </p>
                            <div className="vortex-flex-start vortex-gap-2 vortex-mt-2">
                                <span className="recon-tag-safe vortex-bg-obsidian">Raydium</span>
                                <span className="recon-tag-safe vortex-bg-obsidian">Pump.fun</span>
                                <span className="recon-tag-safe vortex-bg-obsidian">Meteora</span>
                            </div>
                        </div>
                        
                        <div className="vortex-flex-center vortex-gap-3">
                            <div className="vortex-relative">
                                <Search size={16} className="vortex-text-muted vortex-abs-center-y vortex-left-12" />
                                <input
                                    type="search"
                                    aria-label="Filter new pairs"
                                    placeholder="Filter launches..."
                                    className="vortex-input-field vortex-search-input-pl vortex-w-320"
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                />
                            </div>
                            <VortexButton 
                                variant="secondary" 
                                className={`vortex-h-10 ${isRefetching ? 'vortex-animate-pulse' : ''}`}
                                onClick={() => refetch()}
                            >
                                <RefreshCw size={14} className={`vortex-mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                                REFRESH
                            </VortexButton>
                        </div>
                    </div>
                </VortexPanel>

                {/* Data Grid */}
                <VortexPanel title="Latest pools" subTitle="Market data" glowColor="none">
                    {isError ? <div className="vortex-empty" role="alert"><h2>Could not load new pairs</h2><p>The data provider may be busy. Try again in a moment.</p><VortexButton onClick={() => refetch()}>Retry</VortexButton></div> : isLoading ? (
                        <div className="vortex-p-12 vortex-text-center vortex-flex-column vortex-flex-center">
                            <Activity size={32} className="vortex-text-cyan animate-pulse vortex-mb-4" />
                            <p className="vortex-font-mono vortex-text-cyan">Loading new pairs…</p>
                        </div>
                    ) : filteredLaunches.length === 0 ? (
                        <div className="vortex-p-12 vortex-text-center vortex-opacity-50">
                            <AlertTriangle size={32} className="vortex-m-auto vortex-mb-4 text-vortex-yellow" />
                            <p className="vortex-font-mono">No pairs match your filters. Clear the search or refresh.</p>
                        </div>
                    ) : (
                        <div className="vortex-table-container">
                            <table className="vortex-table">
                                <thead>
                                    <tr>
                                        <th>Token</th>
                                        <th>Age</th>
                                        <th>DEX</th>
                                        <th className="vortex-text-right">Liquidity</th>
                                        <th className="vortex-text-right">24h volume</th>
                                        <th className="vortex-text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLaunches.map((launch: any) => (
                                        <tr key={launch.address} className="vortex-table-row">
                                            <td>
                                                <div className="vortex-flex-start vortex-gap-3">
                                                    {launch.logoURI ? (
                                                        <img src={launch.logoURI} alt="Logo" className="vortex-logo-mini vortex-border-radius-full" />
                                                    ) : (
                                                        <div className="vortex-logo-mini vortex-border-radius-full vortex-bg-obsidian-soft vortex-flex-center">
                                                            <Rocket size={14} className={launch.launchpadColor} />
                                                        </div>
                                                    )}
                                                    <div className="vortex-flex-column">
                                                        <div className="vortex-text-bold vortex-text-sm vortex-flex-start vortex-gap-2">
                                                            {launch.name.split(' / ')[0]}
                                                            {launch.isVerified && <ShieldCheck size={14} className="text-vortex-cyan" />}
                                                        </div>
                                                        <div className="vortex-text-tiny vortex-text-muted vortex-font-mono">
                                                            {launch.address.slice(0, 8)}...{launch.address.slice(-4)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="vortex-flex-start vortex-gap-2 vortex-text-sm">
                                                    <Clock size={12} className="vortex-text-muted" />
                                                    {getTimeAgo(launch.poolCreatedAt)}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`recon-tag-safe ${launch.launchpadColor.replace('text-', 'vortex-border-')} ${launch.launchpadColor}`}>
                                                    {launch.launchpad}
                                                </span>
                                            </td>
                                            <td className="vortex-text-right vortex-text-sm vortex-font-mono">
                                                {formatCurrency(launch.liquidityUsd)}
                                            </td>
                                            <td className="vortex-text-right vortex-text-sm vortex-font-mono">
                                                {formatCurrency(launch.volume24h)}
                                            </td>
                                            <td className="vortex-text-right">
                                                <VortexButton 
                                                    variant="primary" 
                                                    onClick={() => router.push(`/token/${launch.address}`)}
                                                >
                                                    Explore <ArrowRight size={14} className="vortex-ml-2" />
                                                </VortexButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </VortexPanel>
            </div>
            
            <MobileNav />
        </main>
    );
}
