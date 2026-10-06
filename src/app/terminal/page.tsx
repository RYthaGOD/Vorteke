'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowUpRight, ArrowDownUp, RefreshCw, Wallet, Activity, SlidersHorizontal, X, Radio, Layers, TrendingUp } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getRecentlyViewed, getUserPortfolio, TokenInfo, formatCurrency, formatCompact, formatPercent } from '@/lib/dataService';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { VortexPanel } from '@/components/DesignSystem';
import { MobileNav } from '@/components/MobileNav';
import { FeaturedProjects } from '@/components/FeaturedProjects';
import { BoostedTicker } from '@/components/BoostedTicker';
import { TrendingStrip } from '@/components/TrendingStrip';
import { TokenAvatar } from '@/components/TokenAvatar';
import { FeedStatus } from '@/components/FeedStatus';

export interface PortfolioItem { address: string; symbol: string; name: string; logoURI?: string; priceUsd: number; balance: number; valueUsd: number; pnlPercent: number; }
const tabs = [['trending', 'Trending'], ['new', 'New pairs'], ['gainers', 'Gainers'], ['losers', 'Losers'], ['top100', 'Top pools'], ['pumpfun', 'Pump.fun'], ['captured', 'Tracked'], ['verified', 'Promoted']];
const sortable = ['priceUsd', 'priceChange24h', 'volume24h', 'liquidityUsd'] as const;
type SortKey = typeof sortable[number];
function Terminal() {
    const params = useSearchParams();
    const router = useRouter();
    const { publicKey, connected, isElite } = useVortexAuth();
    const activeTab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab')! : 'trending';
    const [search, setSearch] = useState(params.get('q') || '');
    const [query, setQuery] = useState(search);
    const [recent, setRecent] = useState<TokenInfo[]>([]);
    const [compact, setCompact] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const portfolioRef = useRef<HTMLElement>(null);
    useEffect(() => { setRecent(getRecentlyViewed()); }, []);
    useEffect(() => { if (params.get('focusSearch') === 'true') input.current?.focus(); if (params.get('tab') === 'portfolio') portfolioRef.current?.scrollIntoView(); }, [params]);
    const urlQuery = params.get('q') || '';
    useEffect(() => { setSearch(urlQuery); setQuery(urlQuery); }, [urlQuery]);
    useEffect(() => {
        if (search === urlQuery) return;
        const timer = setTimeout(() => {
            const next = new URLSearchParams(params.toString());
            if (search.trim()) next.set('q', search.trim()); else next.delete('q');
            next.delete('focusSearch');
            router.replace('/terminal?' + next.toString(), { scroll: false });
            setQuery(search.trim());
        }, 350);
        return () => clearTimeout(timer);
    }, [search, urlQuery, params, router]);
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]')) return;
            if (event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key === 'k')) { event.preventDefault(); input.current?.focus(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
    const market = useQuery<{ rows: TokenInfo[]; updatedAt: number | null; stale: boolean }>({
        queryKey: ['market', activeTab, query],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/discovery?type=' + (query.length >= 2 ? 'search&q=' + encodeURIComponent(query) : activeTab), { signal });
            if (!res.ok) throw new Error('Market data unavailable');
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Invalid market response');
            const updated = res.headers.get('X-Data-Updated');
            return { rows: [...new Map<string, TokenInfo>(data.map((token: TokenInfo) => [token.address, token])).values()], updatedAt: updated ? Date.parse(updated) : null, stale: res.headers.get('X-Data-Stale') === '1' };
        }, staleTime: 30000, refetchInterval: 60000,
    });
    const portfolio = useQuery({ queryKey: ['portfolio', publicKey?.toBase58()], queryFn: () => getUserPortfolio(publicKey!.toBase58(), isElite), enabled: connected && !!publicKey, refetchInterval: 45000 });
    const sortKey = sortable.includes(params.get('sort') as SortKey) ? params.get('sort') as SortKey : activeTab === 'gainers' || activeTab === 'losers' ? 'priceChange24h' : null;
    const ascending = params.get('dir') ? params.get('dir') === 'asc' : activeTab === 'losers';
    const tokens = useMemo(() => {
        const rows = [...(market.data?.rows || [])];
        if (sortKey) rows.sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            if (av == null || !Number.isFinite(av)) return bv == null || !Number.isFinite(bv) ? 0 : 1;
            if (bv == null || !Number.isFinite(bv)) return -1;
            return ascending ? av - bv : bv - av;
        });
        return rows;
    }, [market.data, sortKey, ascending]);
    const selectTab = (tab: string) => { const next = new URLSearchParams(params.toString()); next.set('tab', tab); next.delete('sort'); next.delete('dir'); router.replace('/terminal?' + next.toString(), { scroll: false }); };
    const sort = (key: SortKey) => { const next = new URLSearchParams(params.toString()); next.set('sort', key); next.set('dir', sortKey === key && !ascending ? 'asc' : 'desc'); router.replace('/terminal?' + next.toString(), { scroll: false }); };
    const volume = tokens.reduce((sum, token) => sum + (Number.isFinite(token.volume24h) ? token.volume24h : 0), 0);
    const gainers = tokens.filter(token => token.priceChange24h > 0).length;
    return <main id="main-content" className="vortex-workspace vortex-pulse-workspace">
        <div className="vortex-page-heading"><div><span className="vortex-eyebrow"><span className="vortex-status-dot" /> SOLANA / MARKET TERMINAL</span><h1>Find your <em>edge.</em></h1><p>The market moves. Stay in the flow.</p></div><FeedStatus updatedAt={market.data?.updatedAt || market.dataUpdatedAt} fetching={market.isFetching} error={market.isError} /></div>
        <TrendingStrip />
        <div className="vortex-market-layout">
            <section className="vortex-market-main" aria-label="Token markets">
                <div className="vortex-market-title"><div><Activity size={18} aria-hidden /><h2>Market overview</h2></div><span>01 / DISCOVER</span></div>
                <div className="vortex-market-toolbar"><label className="vortex-market-search" htmlFor="market-search"><Search size={18} aria-hidden /><input ref={input} id="market-search" type="search" autoComplete="off" spellCheck={false} placeholder="Search tokens or paste a mint address" value={search} onChange={e => setSearch(e.target.value)} /><span className="vortex-sr-only">Search token name or mint address</span><kbd>/</kbd></label><button className="vortex-icon-btn vortex-density-toggle" aria-label="Compact table rows" aria-pressed={compact} onClick={() => setCompact(!compact)}><SlidersHorizontal size={18} aria-hidden /></button><button className="vortex-icon-btn" aria-label="Refresh market data" disabled={market.isFetching} onClick={() => market.refetch()}><RefreshCw size={18} aria-hidden className={market.isFetching ? 'vortex-refreshing' : ''} /></button></div>
                <div className="vortex-market-filters" aria-label="Market categories">{tabs.map(([key, label]) => <button key={key} aria-pressed={activeTab === key} onClick={() => selectTab(key)}>{key === 'trending' && <TrendingUp size={14} aria-hidden />}{label}</button>)}</div>
                <div className="vortex-market-meta"><span>{query.length >= 2 ? 'Results for “' + query + '”' : 'Solana / ' + tabs.find(([key]) => key === activeTab)?.[1]}{query && <button className="vortex-clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} aria-hidden /></button>}</span><span>{tokens.length} tokens · 24h metrics</span></div>
                {market.data?.stale && market.data.updatedAt && <p className="vortex-inline-notice" role="status">The data provider is busy. Showing markets from {new Date(market.data.updatedAt).toLocaleTimeString()}.</p>}
                {market.isError ? <div className="vortex-empty" role="alert"><Activity size={28} aria-hidden /><h2>Market data is unavailable</h2><p>Your connection or the data provider may be busy. Try again in a moment.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => market.refetch()}>Try again</button></div> :
                    <div className={'vortex-data-table-container ' + (compact ? 'vortex-table-compact' : '')} tabIndex={0} role="region" aria-label="Scrollable token market table"><table className="vortex-data-table"><thead><tr><th scope="col">Token / pair</th>{([['priceUsd', 'Price'], ['priceChange24h', '24h change'], ['volume24h', '24h volume'], ['liquidityUsd', 'Liquidity']] as const).map(([key, title]) => <th scope="col" key={key} aria-sort={sortKey === key ? ascending ? 'ascending' : 'descending' : 'none'}><button className="vortex-sort-button" onClick={() => sort(key)}>{title}<ArrowDownUp size={12} aria-hidden /></button></th>)}<th scope="col">Profile</th></tr></thead><tbody>
                    {market.isLoading ? Array.from({ length: 7 }, (_, i) => <tr key={i}><td colSpan={6}><div className="vortex-market-skeleton" aria-label="Loading token" role={i === 0 ? 'status' : undefined} /></td></tr>) :
                        tokens.map((token, i) => <tr key={token.address}><td><Link className="vortex-token-link" href={'/token/' + token.address}><span className="vortex-row-rank">{String(i + 1).padStart(2, '0')}</span><TokenAvatar symbol={token.symbol || '?'} src={token.logoURI} /><span><strong>{token.symbol}<span className="vortex-pair-quote"> / USD</span></strong><small>{token.name}</small></span><ArrowUpRight size={14} aria-hidden /></Link></td><td>{token.priceUsd > 0 ? formatCurrency(token.priceUsd) : '—'}</td><td className={token.priceChange24h >= 0 ? 'vortex-positive' : 'vortex-negative'}>{token.priceChange24h == null ? '—' : formatPercent(token.priceChange24h)}</td><td>${formatCompact(token.volume24h)}</td><td>${formatCompact(token.liquidityUsd)}</td><td><span className={'vortex-profile-label ' + (token.boosted || (token.tier && token.tier !== 'Basic') ? 'vortex-profile-paid' : '')}>{token.boosted ? 'Promoted · Paid' : token.tier && token.tier !== 'Basic' ? 'Enhanced · Paid' : 'Standard'}</span></td></tr>)}
                    </tbody></table>{!market.isLoading && tokens.length === 0 && <div className="vortex-empty"><Search size={28} aria-hidden /><h2>No tokens found</h2><p>Try a full mint address or another market category.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => { setSearch(''); selectTab('trending'); }}>Browse trending</button></div>}</div>}
                <p className="vortex-table-footnote"><Radio size={12} aria-hidden /> Market snapshots refresh every 60s. Provider data may be delayed.</p>
            </section>
            <aside className="vortex-market-sidebar">
                <VortexPanel title="In your view" subTitle="Current results" glowColor="none"><div className="vortex-market-summary"><div><span>Tokens discovered</span><strong>{market.isLoading ? '—' : tokens.length.toString().padStart(2, '0')}</strong></div><div><span>Combined 24h pool volume</span><strong>{market.isLoading ? '—' : '$' + formatCompact(volume)}</strong></div><div><span>Positive 24h change</span><strong className="vortex-positive">{market.isLoading ? '—' : gainers + ' / ' + tokens.length}</strong></div></div></VortexPanel>
                <section ref={portfolioRef} className="vortex-portfolio-section"><VortexPanel title="Your portfolio" subTitle="Wallet overview" glowColor="none">
                    {!connected ? <div className="vortex-empty"><span className="vortex-empty-icon"><Wallet size={24} aria-hidden /></span><h2>Your next move<br />starts here.</h2><p>Connect a wallet to view your Solana holdings.</p><WalletMultiButton /></div> : portfolio.isLoading ? <p role="status">Loading holdings…</p> : portfolio.isError ? <div><p>Could not load holdings.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => portfolio.refetch()}>Retry</button></div> : !portfolio.data?.length ? <p>No holdings found for this wallet.</p> :
                        <ul className="vortex-featured-list">{portfolio.data.map(item => <li key={item.address}><Link href={'/token/' + item.address}><strong>{item.symbol}</strong><span>{formatCurrency(item.valueUsd)}</span></Link></li>)}</ul>}
                </VortexPanel></section>
                <VortexPanel title="Recently viewed" glowColor="none">{recent.length ? <ul className="vortex-featured-list">{recent.slice(0, 5).map(token => <li key={token.address}><Link href={'/token/' + token.address}><TokenAvatar symbol={token.symbol} src={token.logoURI} /><strong>{token.symbol}</strong><ArrowUpRight size={14} aria-hidden /></Link></li>)}</ul> : <p className="vortex-text-muted">Your trail starts with a token. Open a chart to keep it here.</p>}</VortexPanel>
                <FeaturedProjects />
                <div className="vortex-project-callout"><Layers size={22} aria-hidden /><span className="vortex-eyebrow">BUILT SOMETHING?</span><h3>Give it a presence.</h3><p>Your identity. Your links. Your token profile.</p><Link href="/#projects">Explore profile upgrades <ArrowUpRight size={16} aria-hidden /></Link></div>
            </aside>
        </div>
        <BoostedTicker />
        <div className="vortex-workspace-footer"><span>VORTEX <span className="vortex-text-muted">/ SOLANA MARKETS</span></span><span>Paid profiles are promotional, not safety certifications. <Link href="/risk">Risk notice</Link> · <Link href="/terms">Terms</Link></span></div>
        <MobileNav />
    </main>;
}
export default function TerminalPage() { return <Suspense fallback={<main id="main-content" className="vortex-workspace" role="status">Loading markets…</main>}><Terminal /></Suspense>; }
