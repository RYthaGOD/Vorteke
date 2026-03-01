'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDiscoveryList, fetchTokenData, resolveSearch, getQuickRecon, getUserPortfolio, getRecentlyViewed, TokenInfo, formatCurrency, formatCompact, formatPercent } from '@/lib/dataService';
import { Search, Filter, ArrowUpRight, Activity, Zap, TrendingUp, Clock, BarChart3, ShieldCheck, ShieldAlert, Loader2, Wallet, TrendingDown } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { MobileNav } from '@/components/MobileNav';
import { useNotificationStore } from '@/lib/store';

import { VortexPanel, VortexButton } from '@/components/DesignSystem';

type DiscoveryType = 'trending' | 'new' | 'gainers' | 'top100' | 'pumpfun' | 'captured';

export default function Home() {
    const router = useRouter();
    const { publicKey, connected } = useWallet();
    const [activeTab, setActiveTab] = useState<DiscoveryType>('trending');
    const notify = useNotificationStore(state => state.notify);

    // Discovery Hub Query
    const { data: tokens = [], isLoading: discoveryLoading } = useQuery({
        queryKey: ['discovery', activeTab],
        queryFn: () => getDiscoveryList(activeTab),
        refetchInterval: 30000,
        staleTime: 15000,
    });

    // Tactical Pulse Query
    const pulseSource = (activeTab === 'captured' || activeTab === 'top100') ? activeTab : 'trending';
    const { data: pulseData = [] } = useQuery({
        queryKey: ['discovery', pulseSource],
        queryFn: () => getDiscoveryList(pulseSource),
        refetchInterval: 60000,
        staleTime: 30000,
    });
    const pulseTokens = pulseData.slice(0, 3);

    // Portfolio Intelligence Query
    const { data: portfolio = [], isLoading: portfolioLoading } = useQuery({
        queryKey: ['portfolio', publicKey?.toString()],
        queryFn: () => getUserPortfolio(publicKey!.toString()),
        enabled: !!publicKey && connected,
        refetchInterval: 45000,
    });

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [mounted, setMounted] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Trending suggestions query (enabled only on focus)
    const { data: suggestionsData = [] } = useQuery({
        queryKey: ['discovery', 'trending'],
        queryFn: () => getDiscoveryList('trending'),
        enabled: showOverlay && searchQuery.length < 2,
        staleTime: 300000,
    });
    const trendingSuggestions = suggestionsData.slice(0, 5);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSearchFocus = () => {
        setShowOverlay(true);
    };

    // Search Logic (Optimized for Aggregator)
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setSearchLoading(true);
                try {
                    const res = await fetch(`/api/discovery?type=search&q=${searchQuery}`);
                    const results = await res.json();
                    setSearchResults(results);
                    setShowOverlay(true);
                } catch (e) {
                    console.error("Search error:", e);
                } finally {
                    setSearchLoading(false);
                    setFocusedIndex(-1);
                }
            } else {
                setSearchResults([]);
                if (searchQuery.length === 0) setShowOverlay(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Only close if clicking truly outside the search wrapper
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                // Small timeout to allow any pending clicks on results to register
                setTimeout(() => setShowOverlay(false), 100);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showOverlay) return;
        if (e.key === 'ArrowDown') {
            setFocusedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
            router.push(`/token/${searchResults[focusedIndex].address}`);
        } else if (e.key === 'Escape') {
            setShowOverlay(false);
        }
    };

    return (
        <main className="app-container">
            <div className="vortex-container-centered">
                <header className="vortex-header">
                    <div className="brand-section">
                        <div className="vortex-logo glitch-text">
                            <div className="vortex-logo-icon"></div>
                            VORTEX
                        </div>
                        <span className="vortex-tagline">Master the Singularity.</span>
                    </div>
                    <nav className="nav-cluster">
                        <button
                            className={`nav-item ${activeTab !== 'captured' ? 'active' : ''} vortex-glitch-hover`}
                            onClick={() => setActiveTab('trending')}
                        >
                            Screener
                        </button>
                        <button
                            className={`nav-item vortex-glitch-hover`}
                            onClick={() => {
                                if (!connected) {
                                    document.querySelector<HTMLButtonElement>('.wallet-adapter-button')?.click();
                                } else {
                                    document.getElementById('portfolio-section')?.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                        >
                            Portfolio
                        </button>
                        <button
                            className="nav-item vortex-glitch-hover"
                            onClick={() => router.push('/elite')}
                        >
                            Elite Analytics
                        </button>
                    </nav>
                    <div className="header-actions">
                        {mounted ? <WalletMultiButton className="vortex-wallet-btn" /> : <div className="btn-vortex btn-vortex-primary vortex-opacity-50">INITIALIZING...</div>}
                    </div>
                </header>
            </div>

            <div className="vortex-container-centered">
                <div className="main-content">
                    <div className="vortex-dashboard-grid">
                        {/* Tactical Sidebar */}
                        <aside className="vortex-sidebar">
                            <VortexPanel title="PORTFOLIO_INTEL" subTitle="ACTIVE_ASSETS" glowColor="cyan">
                                <div id="portfolio-section">
                                    {!connected ? (
                                        <div className="vortex-p-6 vortex-bg-obsidian-soft vortex-border vortex-border-dashed vortex-border-vortex-muted vortex-border-radius-lg vortex-text-center">
                                            <div className="vortex-animate-pulse vortex-mb-4">
                                                <Wallet size={32} className="vortex-text-muted vortex-m-auto" />
                                            </div>
                                            <p className="vortex-text-xs vortex-text-muted vortex-ls-wide vortex-mb-4">AWAITING_WALLET_LINK</p>
                                            <button
                                                className="btn-vortex btn-vortex-primary vortex-bg-purple vortex-w-full vortex-text-xs"
                                                onClick={() => document.querySelector<HTMLButtonElement>('.wallet-adapter-button')?.click()}
                                            >
                                                CONNECT WALLET FOR LIVE PNL
                                            </button>
                                        </div>
                                    ) : portfolioLoading ? (
                                        <div className="vortex-text-center vortex-p-4 text-vortex-yellow vortex-font-mono vortex-text-xs">
                                            SYNCING ASSETS...
                                        </div>
                                    ) : portfolio.length === 0 ? (
                                        <p className="vortex-text-xs vortex-text-muted vortex-text-center">No active tactical assets detected.</p>
                                    ) : (
                                        <ul className="vortex-sidebar-list vortex-list-reset">
                                            {portfolio.map((item) => (
                                                <li key={item.address} className="vortex-mb-2">
                                                    <button className="vortex-list-item-clickable vortex-full-width" onClick={() => router.push(`/token/${item.address}`)}>
                                                        <div className="vortex-flex-between">
                                                            <div className="vortex-flex-column vortex-align-start">
                                                                <div className="vortex-text-bold vortex-text-md">{item.symbol}</div>
                                                                <div className="vortex-text-tiny vortex-text-muted">{item.balance.toFixed(2)} units</div>
                                                            </div>
                                                            <div className="vortex-flex-column vortex-align-end">
                                                                <div className="vortex-text-sm vortex-text-bright">{formatCurrency(item.valueUsd)}</div>
                                                                <div className={`${item.pnlPercent >= 0 ? 'text-vortex-yellow' : 'text-vortex-red'} vortex-text-xs vortex-text-extrabold`}>
                                                                    {item.pnlPercent >= 0 ? 'â–²' : 'â–¼'} {Math.abs(item.pnlPercent).toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </VortexPanel>

                            <VortexPanel title="TACTICAL_PULSE" subTitle="LIVE_SIGNAL" glowColor="none">
                                <ul className="vortex-sidebar-list vortex-list-reset">
                                    {pulseTokens.length === 0 ? (
                                        <div className="vortex-p-4 vortex-text-center vortex-opacity-50">
                                            <Activity size={24} className="vortex-m-auto vortex-mb-2 text-vortex-cyan" />
                                            <p className="vortex-text-tiny vortex-font-mono">SCANNING_CHANNELS...</p>
                                        </div>
                                    ) : (
                                        pulseTokens.map((t) => (
                                            <li key={t.address} className="vortex-mb-2">
                                                <button className="vortex-list-item-clickable vortex-full-width" onClick={() => router.push(`/token/${t.address}`)}>
                                                    <div className="vortex-flex-between">
                                                        <div className="vortex-flex-column vortex-align-start">
                                                            <div className="vortex-text-bold vortex-text-sm">{t.symbol}</div>
                                                            <div className="vortex-text-tiny vortex-text-muted">MCAP {formatCompact(t.mcap)}</div>
                                                        </div>
                                                        <div className={`${t.priceChange24h >= 0 ? 'text-vortex-yellow' : 'text-vortex-red'} vortex-text-sm vortex-text-bold`}>
                                                            {t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h.toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </button>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </VortexPanel>
                        </aside>

                        <section className="vortex-dashboard-main animate-stagger vortex-animate-delay-200">
                            <VortexPanel title="DISCOVERY_HUB" subTitle="MARKET_RECON" glowColor="yellow" className="vortex-mb-4">
                                <div className="vortex-flex-between vortex-mb-2">
                                    <p className="vortex-text-xs vortex-text-muted vortex-m-0">Real-time market reconnaissance protocols.</p>
                                    <div className="vortex-flex-center vortex-gap-3">
                                        <div className="vortex-relative" ref={searchRef}>
                                            <Search size={16} className="vortex-text-muted vortex-abs-center-y vortex-left-12" />
                                            <input
                                                type="text"
                                                placeholder="Scan contract address..."
                                                className="vortex-input-field vortex-search-input-pl vortex-w-320"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onFocus={handleSearchFocus}
                                                onKeyDown={handleKeyDown}
                                            />
                                            {searchLoading && <Loader2 size={14} className="vortex-text-green animate-spin vortex-abs-center-y vortex-right-12" />}
                                            {showOverlay && (
                                                <div className="vortex-search-overlay">
                                                    {searchQuery.length < 2 ? (
                                                        <div className="vortex-search-suggestions">
                                                            <div className="vortex-suggestion-group">
                                                                <div className="vortex-suggestion-header">TRENDING NOW</div>
                                                                {trendingSuggestions.map(token => (
                                                                    <div
                                                                        key={token.address}
                                                                        className="vortex-search-item"
                                                                        onClick={() => router.push(`/token/${token.address}`)}
                                                                        tabIndex={0}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                e.preventDefault();
                                                                                router.push(`/token/${token.address}`);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="vortex-flex-start vortex-gap-3">
                                                                            <img src={token.logoURI} alt="" className="vortex-logo-mini vortex-border-radius-full" />
                                                                            <span className="vortex-text-sm vortex-text-bold">{token.symbol}</span>
                                                                        </div>
                                                                        <span className="vortex-text-xs vortex-text-muted">{token.name}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        searchResults.map((res, idx) => (
                                                            <div
                                                                key={res.address}
                                                                className={`vortex-search-item ${focusedIndex === idx ? 'focused' : ''}`}
                                                                onClick={() => router.push(`/token/${res.address}`)}
                                                                tabIndex={0}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        router.push(`/token/${res.address}`);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="vortex-flex-start vortex-gap-3">
                                                                    <img src={res.logoURI} alt="" className="vortex-logo-mini vortex-border-radius-full" />
                                                                    <div className="vortex-flex-column">
                                                                        <div className="vortex-text-sm vortex-text-bold">{res.symbol}</div>
                                                                        <div className="vortex-text-tiny vortex-text-muted">{res.name}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="vortex-flex-column vortex-align-end">
                                                                    <div className="vortex-text-sm text-vortex-cyan">{formatCurrency(res.priceUsd, 4)}</div>
                                                                    <div className="vortex-flex vortex-gap-1">
                                                                        {res.securityTags?.slice(0, 2).map((tag: string) => (
                                                                            <span key={tag} className="recon-tag-safe vortex-text-tiny">{tag}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <VortexButton
                                            variant="secondary"
                                            className="vortex-h-10"
                                            onClick={() => notify('info', 'ADVANCED_FILTERS_LOCKED: Acquire the Vortex Elite NFT to unlock.')}
                                        >
                                            <Filter size={14} className="vortex-mr-2" />
                                            FILTERS
                                        </VortexButton>
                                    </div>
                                </div>

                                <div className="vortex-flex vortex-gap-2 vortex-border-b vortex-border-vortex vortex-mb-2 vortex-overflow-x-auto">
                                    {[
                                        { id: 'trending', label: 'TRENDING' },
                                        { id: 'new', label: 'NEW_PAIRS' },
                                        { id: 'pumpfun', label: 'PUMP_FUN' },
                                        { id: 'gainers', label: 'GAINERS' },
                                        { id: 'top100', label: 'TOP_100' }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as DiscoveryType)}
                                            className={`vortex-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="vortex-data-table-container">
                                    <table className="vortex-data-table">
                                        <thead>
                                            <tr>
                                                <th>ASSET</th>
                                                <th>PRICE</th>
                                                <th>24H_SHIFT</th>
                                                <th>VOLUME</th>
                                                <th>LIQUIDITY</th>
                                                <th className="vortex-hide-mobile">SECURITY</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {discoveryLoading ? (
                                                <tr>
                                                    <td colSpan={7} className="vortex-text-center vortex-p-10 text-vortex-yellow vortex-font-mono">
                                                        SYNCHRONIZING_NEURAL_MESH...
                                                    </td>
                                                </tr>
                                            ) : tokens.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="vortex-text-center vortex-p-10 vortex-text-muted">
                                                        <Activity size={24} className="vortex-m-auto vortex-mb-2 vortex-opacity-30" />
                                                        <p className="vortex-text-tiny vortex-font-mono">NO_ACTIVE_RECONNAISSANCE_DATA_IN_THIS_SECTOR</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                tokens.map((token) => (
                                                    <tr
                                                        key={token.address}
                                                        className="clickable-row glitch-text"
                                                        onClick={() => router.push(`/token/${token.address}`)}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                router.push(`/token/${token.address}`);
                                                            }
                                                        }}
                                                    >
                                                        <td>
                                                            <div className="vortex-flex-start vortex-gap-3">
                                                                <img src={token.logoURI} alt="" className="vortex-logo-mini vortex-border-radius-full" />
                                                                <div className="vortex-flex-column">
                                                                    <span className="vortex-text-sm vortex-text-bold">{token.symbol}/SOL</span>
                                                                    <span className="vortex-text-tiny vortex-text-muted">{token.name}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className="vortex-text-sm text-vortex-cyan">{formatCurrency(token.priceUsd, 6)}</span>
                                                        </td>
                                                        <td className={`${token.priceChange24h >= 0 ? 'text-vortex-yellow' : 'text-vortex-red'} vortex-text-bold`}>
                                                            {formatPercent(token.priceChange24h)}
                                                        </td>
                                                        <td>{formatCompact(token.volume24h)}</td>
                                                        <td>{formatCompact(token.liquidityUsd)}</td>
                                                        <td className="vortex-hide-mobile">
                                                            <div className="vortex-flex-start vortex-gap-1">
                                                                {token.securityTags?.map((tag: string) => (
                                                                    <span key={tag} className="badge-vortex badge-verified badge-vortex-mini">{tag.slice(0, 2)}</span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="vortex-text-right">
                                                            <ArrowUpRight size={14} className="vortex-opacity-30" />
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </VortexPanel>
                        </section>
                    </div>
                </div>
            </div>
            <MobileNav />
        </main>
    );
}
