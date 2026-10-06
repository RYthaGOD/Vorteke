'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, Radio, RefreshCw, Search, X } from 'lucide-react';
import { MobileNav } from '@/components/MobileNav';
import { TokenAvatar } from '@/components/TokenAvatar';
import { FeedStatus } from '@/components/FeedStatus';
import { formatCompact } from '@/lib/dataService';

interface Launch { address: string; name: string; liquidityUsd: number; volume24h: number; poolCreatedAt: string; launchpad: string; logoURI?: string | null; tier?: string; boosted?: boolean }

const age = (dateStr: string, now: number) => {
    const seconds = Math.max(0, Math.floor((now - new Date(dateStr).getTime()) / 1000));
    if (seconds < 60) return seconds + 's';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm';
    return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
};

export default function NewLaunchesPage() {
    const [filter, setFilter] = useState('');
    const launches = useQuery({
        queryKey: ['new_launches'],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/launches', { signal });
            if (!res.ok) throw new Error('New pairs unavailable');
            return { rows: await res.json() as Launch[], updatedAt: res.headers.get('X-Data-Updated'), stale: res.headers.get('X-Data-Stale') === '1' };
        },
        refetchInterval: 30_000, staleTime: 15_000,
    });
    const now = launches.dataUpdatedAt || Date.now();
    const needle = filter.trim().toLowerCase();
    const rows = (launches.data?.rows || []).filter(l => !needle || l.name.toLowerCase().includes(needle) || l.address.toLowerCase().includes(needle));
    const updatedAt = launches.data?.updatedAt ? new Date(launches.data.updatedAt) : null;

    return <main id="main-content" className="vortex-workspace vortex-pulse-workspace">
        <div className="vortex-page-heading"><div>
            <span className="vortex-eyebrow"><span className="vortex-status-dot" /> SOLANA / NEW PAIRS</span>
            <h1>Fresh <em>liquidity.</em></h1>
            <p>The newest pools across Solana DEXs and launchpads.</p>
        </div><FeedStatus updatedAt={updatedAt?.getTime() || launches.dataUpdatedAt} fetching={launches.isFetching} error={launches.isError} /></div>
        <section className="vortex-market-main" aria-label="New pairs">
            <div className="vortex-market-toolbar">
                <label className="vortex-market-search" htmlFor="pairs-filter"><Search size={18} aria-hidden />
                    <input id="pairs-filter" type="search" autoComplete="off" spellCheck={false} placeholder="Filter by name or mint address" value={filter} onChange={e => setFilter(e.target.value)} />
                    <span className="vortex-sr-only">Filter new pairs</span>
                </label>
                <button className="vortex-icon-btn" aria-label="Refresh new pairs" disabled={launches.isFetching} onClick={() => launches.refetch()}><RefreshCw size={18} aria-hidden className={launches.isFetching ? 'vortex-refreshing' : ''} /></button>
            </div>
            {launches.data?.stale && updatedAt && <p className="vortex-inline-notice" role="status">The data provider is busy. Showing pairs from {updatedAt.toLocaleTimeString()}.</p>}
            {launches.isError ? <div className="vortex-empty" role="alert"><Activity size={28} aria-hidden /><h2>New pairs are unavailable</h2><p>The data provider may be busy. Try again in a moment.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => launches.refetch()}>Try again</button></div> :
                <div className="vortex-data-table-container" tabIndex={0} role="region" aria-label="Scrollable new pairs table"><table className="vortex-data-table"><thead><tr><th scope="col">Token</th><th scope="col">Age</th><th scope="col">Venue</th><th scope="col">Liquidity</th><th scope="col">24h volume</th></tr></thead><tbody>
                    {launches.isLoading ? Array.from({ length: 7 }, (_, i) => <tr key={i}><td colSpan={5}><div className="vortex-market-skeleton" aria-label="Loading pair" role={i === 0 ? 'status' : undefined} /></td></tr>) :
                        rows.map(launch => <tr key={launch.address}>
                            <td><Link className="vortex-token-link" href={'/token/' + launch.address}><TokenAvatar symbol={launch.name.split(' / ')[0] || '?'} src={launch.logoURI || undefined} /><span><strong>{launch.name.split(' / ')[0]}</strong><small>{launch.address.slice(0, 6)}…{launch.address.slice(-4)}{launch.tier && launch.tier !== 'Basic' ? ' · Enhanced' : ''}{launch.boosted ? ' · Promoted' : ''}</small></span><ArrowUpRight size={14} aria-hidden /></Link></td>
                            <td>{age(launch.poolCreatedAt, now)}</td>
                            <td>{launch.launchpad}</td>
                            <td>${formatCompact(launch.liquidityUsd)}</td>
                            <td>${formatCompact(launch.volume24h)}</td>
                        </tr>)}
                </tbody></table>
                    {!launches.isLoading && rows.length === 0 && <div className="vortex-empty"><Search size={28} aria-hidden />{needle ? <><h2>No pairs match &ldquo;{filter}&rdquo;</h2><p>Try another name or mint address.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => setFilter('')}><X size={14} aria-hidden /> Clear filter</button></> : <><h2>No new pairs yet</h2><p>New pools appear here as they launch.</p></>}</div>}
                </div>}
            <p className="vortex-table-footnote"><Radio size={12} aria-hidden /> Refreshes every 30s. New pools are unvetted; open a token to run the free holder scan.</p>
        </section>
        <MobileNav />
    </main>;
}
