'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Rocket, Clock, ShieldCheck, ArrowRight, Activity, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { VortexPanel, VortexButton } from '@/components/DesignSystem';
import { MobileNav } from '@/components/MobileNav';
import { formatCurrency, formatCompact } from '@/lib/dataService';

export default function NewLaunchesPage() {
    const [searchFilter, setSearchFilter] = useState('');

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

            <div className="vortex-container-centered vortex-mt-6 animate-stagger">
                {/* Hero / Filter Section */}
                <VortexPanel title="New pairs" subTitle="Solana pools" glowColor="cyan" className="vortex-mb-6">
                    <div className="vortex-flex-between vortex-wrap vortex-gap-4">
                        <div className="vortex-flex-column">
                            <p className="vortex-text-sm vortex-text-muted vortex-m-0">
                                New liquidity pools across Solana DEXs, refreshed every 15 seconds.
                            </p>
                            <div className="vortex-flex-start vortex-gap-2 vortex-mt-2">
                                <span className="vortex-profile-label">Raydium</span>
                                <span className="vortex-profile-label">Pump.fun</span>
                                <span className="vortex-profile-label">Meteora</span>
                            </div>
                        </div>
                        
                        <div className="vortex-flex-center vortex-gap-3">
                            <label className="vortex-market-search">
                                <Search size={18} aria-hidden />
                                <input
                                    type="search"
                                    aria-label="Filter new pairs"
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder="Filter pairs"
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                />
                            </label>
                            <VortexButton 
                                variant="secondary" 
                                className={`vortex-h-10 ${isRefetching ? 'vortex-animate-pulse' : ''}`}
                                onClick={() => refetch()}
                            >
                                <RefreshCw size={14} className={`vortex-mr-2 ${isRefetching ? 'animate-spin' : ''}`} aria-hidden />
                                Refresh
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
                        <div className="vortex-empty">
                            <AlertTriangle size={28} aria-hidden />
                            {searchFilter ? <><h2>No pairs match &ldquo;{searchFilter}&rdquo;</h2><p>Try another name or symbol.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => setSearchFilter('')}>Clear search</button></> : <><h2>No new pairs yet</h2><p>New pools appear here as they launch. This list refreshes every 15 seconds.</p></>}
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
                                                <Link className="btn-vortex btn-vortex-primary" href={`/token/${launch.address}`}>
                                                    Explore <ArrowRight size={14} className="vortex-ml-2" aria-hidden />
                                                </Link>
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
