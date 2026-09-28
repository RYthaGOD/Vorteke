'use client';
import Link from 'next/link';
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { TokenAvatar } from './TokenAvatar';
import { formatCurrency, formatCompact, formatPercent } from '@/lib/vortex/token/formatting';
import type { TrendingResponse } from '@/lib/vortex/trending-types';

function Sparkline({ prices }: { prices: number[] }) {
    const low = Math.min(...prices), high = Math.max(...prices);
    const points = prices.map((price, i) => (i / Math.max(prices.length - 1, 1) * 100) + ',' + (30 - (high === low ? 0.5 : (price - low) / (high - low)) * 26)).join(' ');
    return <svg viewBox="0 0 100 36" className="vortex-sparkline" aria-hidden><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}
export function TrendingStrip() {
    const track = useRef<HTMLDivElement>(null);
    const query = useQuery<TrendingResponse>({
        queryKey: ['trending-30m'],
        queryFn: async ({ signal }) => { const response = await fetch('/api/trending', { signal }); if (!response.ok) throw new Error('Trending unavailable'); return response.json(); },
        staleTime: 60000, refetchInterval: 120000, retry: 1,
    });
    const scroll = (direction: number) => track.current?.scrollBy({ left: direction * 264, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    return <section className="vortex-trending" aria-label="Thirty-minute trending tokens">
        <div className="vortex-trending-heading"><div><Flame size={17} aria-hidden /><h2>Market pulse</h2><span className="vortex-window-tag">30 MIN</span></div>
            <div><span className="vortex-trending-caption">Trending pool shortlist</span><button className="vortex-icon-btn" aria-label="Previous trending tokens" onClick={() => scroll(-1)}><ChevronLeft size={16} aria-hidden /></button><button className="vortex-icon-btn" aria-label="Next trending tokens" onClick={() => scroll(1)}><ChevronRight size={16} aria-hidden /></button></div>
        </div>
        {query.isError ? <div className="vortex-strip-message" role="alert">Thirty-minute data is unavailable.<button onClick={() => query.refetch()} disabled={query.isFetching}>Retry</button></div> :
        <div ref={track} className="vortex-trending-track" tabIndex={0} role="region" aria-label="Scrollable trending cards" aria-busy={query.isLoading}>
            {query.isLoading ? Array.from({ length: 6 }, (_, i) => <div key={i} className="vortex-trend-card vortex-trend-skeleton" aria-label={i === 0 ? 'Loading thirty-minute trends' : undefined}><div className="vortex-market-skeleton" /></div>) :
            query.data?.tokens.length ? query.data.tokens.map((token, i) =>
                <Link key={token.address} className="vortex-trend-card" href={'/token/' + token.address}>
                    <div className="vortex-trend-top"><span className="vortex-trend-rank">{String(i + 1).padStart(2, '0')}</span><TokenAvatar symbol={token.symbol} src={token.logoURI} /><strong>{token.symbol}</strong><ArrowUpRight size={14} aria-hidden /></div>
                    <div className="vortex-trend-price"><span>{formatCurrency(token.priceUsd)}</span><span className={token.priceChange30m >= 0 ? 'vortex-positive' : 'vortex-negative'}>{formatPercent(token.priceChange30m)}</span></div>
                    <div className={'vortex-trend-bottom ' + (token.priceChange30m >= 0 ? 'vortex-positive' : 'vortex-negative')}><span>VOL <strong>${formatCompact(token.volume30m)}</strong></span><Sparkline prices={token.prices} /></div>
                </Link>) : <div className="vortex-strip-message">Waiting for a complete 30-minute history. Explore the markets below while this refreshes.</div>}
        </div>}
        <details className="vortex-trending-method"><summary>How this ranking works</summary><p>Up to six pools from GeckoTerminal’s trending shortlist, ranked by USD volume over 30 completed minutes. One pool per token; this is not a market-wide ranking. Price changes and sparklines use that same window. Missing history is excluded. Refreshes every two minutes; provider caching adds delay.{query.data?.windowEnd ? ' Window ended ' + new Date(query.data.windowEnd * 1000).toLocaleTimeString() + '.' : ''}</p></details>
    </section>;
}
