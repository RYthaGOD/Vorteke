'use client';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowUpRight, RefreshCw, Wallet, Activity } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getRecentlyViewed, getUserPortfolio, TokenInfo, formatCurrency, formatCompact, formatPercent, subscribeToServerStream } from '@/lib/dataService';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { VortexPanel } from '@/components/DesignSystem';
import { MobileNav } from '@/components/MobileNav';
import { BurnLeaderboard } from '@/components/BurnLeaderboard';
import { BoostedTicker } from '@/components/BoostedTicker';

export interface PortfolioItem { address: string; symbol: string; name: string; logoURI?: string; priceUsd: number; balance: number; valueUsd: number; pnlPercent: number; }
const tabs = [['trending', 'Trending'], ['new', 'New pairs'], ['gainers', 'Gainers'], ['losers', 'Losers'], ['top100', 'Top pools'], ['pumpfun', 'Pump.fun'], ['captured', 'Tracked'], ['verified', 'Promoted']];
function Terminal() {
    const params = useSearchParams();
    const router = useRouter();
    const { publicKey, connected, isElite } = useVortexAuth();
    const activeTab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab')! : 'trending';
    const [search, setSearch] = useState(params.get('q') || '');
    const [query, setQuery] = useState(search);
    const [recent, setRecent] = useState<TokenInfo[]>([]);
    const input = useRef<HTMLInputElement>(null);
    const portfolioRef = useRef<HTMLElement>(null);
    useEffect(() => { setRecent(getRecentlyViewed()); }, []);
    useEffect(() => { if (params.get('focusSearch') === 'true') input.current?.focus(); if (params.get('tab') === 'portfolio') portfolioRef.current?.scrollIntoView(); }, [params]);
    useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 350); return () => clearTimeout(timer); }, [search]);
    const market = useQuery<TokenInfo[]>({
        queryKey: ['market', activeTab, query],
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/discovery?type=' + (query.length >= 2 ? 'search&q=' + encodeURIComponent(query) : activeTab), { signal });
            if (!res.ok) throw new Error('Market data unavailable');
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Invalid market response');
            const unique = [...new Map<string, TokenInfo>(data.map((token: TokenInfo) => [token.address, token])).values()];
            if (activeTab === 'gainers') unique.sort((a, b) => b.priceChange24h - a.priceChange24h);
            if (activeTab === 'losers') unique.sort((a, b) => a.priceChange24h - b.priceChange24h);
            return unique;
        }, staleTime: 15000, refetchInterval: 60000,
    });
    const { refetch } = market;
    useEffect(() => subscribeToServerStream(undefined, true, event => { if (event.type === 'discovery') void refetch(); }), [refetch]);
    const portfolio = useQuery({ queryKey: ['portfolio', publicKey?.toBase58()], queryFn: () => getUserPortfolio(publicKey!.toBase58(), isElite), enabled: connected && !!publicKey, refetchInterval: 45000 });
    const tokens = market.data || [];
    const selectTab = (tab: string) => { const next = new URLSearchParams(params.toString()); next.set('tab', tab); router.replace('/terminal?' + next.toString(), { scroll: false }); };
    return <main className="vortex-workspace">
        <div className="vortex-page-heading"><div><span className="vortex-eyebrow">MARKET OVERVIEW</span><h1>Find your signal.</h1><p>Explore Solana tokens, trading activity, and liquidity.</p></div><span className="vortex-data-status"><span className="vortex-status-dot" />{market.isFetching ? 'Updating market data' : market.dataUpdatedAt ? 'Updated ' + new Date(market.dataUpdatedAt).toLocaleTimeString() : 'Connecting to market data'}</span></div>
        <BoostedTicker />
        <div className="vortex-market-layout">
            <section className="vortex-market-main" aria-label="Token markets">
                <div className="vortex-market-toolbar"><label className="vortex-market-search" htmlFor="market-search"><Search size={18} aria-hidden /><input ref={input} id="market-search" type="search" autoComplete="off" spellCheck={false} placeholder="Search token name or mint address" value={search} onChange={e => setSearch(e.target.value)} /><span className="vortex-sr-only">Search token name or mint address</span></label><button className="vortex-icon-btn" aria-label="Refresh market data" disabled={market.isFetching} onClick={() => market.refetch()}><RefreshCw size={18} aria-hidden /></button></div>
                <div className="vortex-market-filters" aria-label="Market categories">{tabs.map(([key, label]) => <button key={key} aria-pressed={activeTab === key} onClick={() => selectTab(key)}>{label}</button>)}</div>
                <div className="vortex-market-meta"><span>{query.length >= 2 ? 'Search results' : 'Solana / ' + tabs.find(([key]) => key === activeTab)?.[1]}</span><span>{tokens.length} tokens · 24h metrics</span></div>
                {market.isError ? <div className="vortex-empty" role="alert"><Activity size={28} aria-hidden /><h2>Market data is unavailable</h2><p>Your connection or the data provider may be busy. Try again in a moment.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => market.refetch()}>Try again</button></div> :
                    <div className="vortex-data-table-container" tabIndex={0} role="region" aria-label="Scrollable token market table"><table className="vortex-data-table"><thead><tr><th scope="col">Token</th><th scope="col">Price</th><th scope="col">24h change</th><th scope="col">Volume</th><th scope="col">Liquidity</th><th scope="col">Profile</th></tr></thead><tbody>
                    {market.isLoading ? Array.from({ length: 7 }, (_, i) => <tr key={i}><td colSpan={6}><div className="vortex-market-skeleton" aria-label="Loading token" role={i === 0 ? 'status' : undefined} /></td></tr>) :
                        tokens.map(token => <tr key={token.address}><td><Link className="vortex-token-link" href={'/token/' + token.address}><span className="vortex-token-avatar">{token.symbol?.slice(0, 2) || '?'}</span><span><strong>{token.symbol}</strong><small>{token.name}</small></span><ArrowUpRight size={14} aria-hidden /></Link></td><td>{formatCurrency(token.priceUsd, 6)}</td><td className={token.priceChange24h >= 0 ? 'vortex-positive' : 'vortex-negative'}>{token.priceChange24h == null ? '—' : formatPercent(token.priceChange24h)}</td><td>{formatCompact(token.volume24h)}</td><td>{formatCompact(token.liquidityUsd)}</td><td><span className="vortex-profile-label">{token.tier && token.tier !== 'Basic' ? token.tier + ' · Paid' : 'Standard'}</span></td></tr>)}
                    </tbody></table>{!market.isLoading && tokens.length === 0 && <div className="vortex-empty"><h2>No tokens found</h2><p>Try a full mint address or another market category.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => { setSearch(''); selectTab('trending'); }}>Browse trending</button></div>}</div>}
                <p className="vortex-table-footnote">Data may be delayed. Paid profiles are promotional and do not certify token safety.</p>
            </section>
            <aside className="vortex-market-sidebar">
                <section ref={portfolioRef}><VortexPanel title="Your portfolio" subTitle="Wallet overview" glowColor="none">
                    {!connected ? <div className="vortex-empty"><Wallet size={24} aria-hidden /><p>Connect your wallet to see your holdings alongside the market.</p><WalletMultiButton /></div> : portfolio.isLoading ? <p role="status">Loading holdings…</p> : portfolio.isError ? <div><p>Could not load holdings.</p><button className="btn-vortex btn-vortex-secondary" onClick={() => portfolio.refetch()}>Retry</button></div> : !portfolio.data?.length ? <p>No holdings found for this wallet.</p> :
                        <ul className="vortex-featured-list">{portfolio.data.map(item => <li key={item.address}><Link href={'/token/' + item.address}><strong>{item.symbol}</strong><span>{formatCurrency(item.valueUsd)}</span></Link></li>)}</ul>}
                </VortexPanel></section>
                <BurnLeaderboard />
                <VortexPanel title="Recently viewed" glowColor="none">{recent.length ? <ul className="vortex-featured-list">{recent.slice(0, 5).map(token => <li key={token.address}><Link href={'/token/' + token.address}><strong>{token.symbol}</strong><span>{token.name} ↗</span></Link></li>)}</ul> : <p className="vortex-text-muted">Tokens you explore will appear here.</p>}</VortexPanel>
                <div className="vortex-project-callout"><span className="vortex-eyebrow">BUILDING ON SOLANA?</span><h3>Make your profile count.</h3><p>Add your project identity and official links.</p><Link href="/#projects">Explore profile upgrades ↗</Link></div>
            </aside>
        </div><MobileNav />
    </main>;
}
export default function TerminalPage() { return <Suspense fallback={<main className="vortex-workspace" role="status">Loading markets…</main>}><Terminal /></Suspense>; }
