'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchTokenData, getInitialChartData, subscribeToTokenChart, subscribeToLiveStream, TokenInfo, VortexTx, formatCurrency, registerRecentlyViewed, ChartTick, Timeframe } from '@/lib/dataService';
import {
    ArrowLeft, X, ExternalLink, Zap, ShieldAlert, Globe, Cpu, Users, Info, Settings, Activity, RefreshCcw, ShieldCheck, Check, TrendingUp, Layers, AlertTriangle, Camera, Send, Loader2, ArrowUpRight
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { MobileNav } from '@/components/MobileNav';
import { GlobalNotification } from '@/components/GlobalNotification';
import { BundlePanel } from '@/components/BundlePanel';
import { DeveloperControlPanel } from '@/components/DeveloperControlPanel';
import { VortexPanel, VortexButton } from '@/components/DesignSystem';
import { useNotificationStore } from '@/lib/store';

const TokenChart = dynamic(() => import('@/components/TokenChart').then(mod => mod.TokenChart), {
    ssr: false,
    loading: () => (
        <div className="vortex-full-size vortex-flex-column vortex-center text-vortex-muted vortex-bg-obsidian">
            <Loader2 className="vortex-animate-spin vortex-mb-2" size={24} />
            <span className="vortex-text-tiny vortex-font-mono">INITIALIZING_CANVAS_ENGINE...</span>
        </div>
    ),
});

function TokenDetailContent({ initialAddress }: { initialAddress?: string }) {
    const router = useRouter();
    const wallet = useWallet();
    const address = initialAddress || '';
    const [timeframe, setTimeframe] = useState<Timeframe>('1M');
    const [realtimeData, setRealtimeData] = useState<ChartTick | null>(null);
    const [txs, setTxs] = useState<VortexTx[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const [showEnhanceModal, setShowEnhanceModal] = useState(false);

    const notify = useNotificationStore((state) => state.notify);

    // Primary Data Reconnaissance
    const { data: token, isLoading: tokenLoading, error, refetch: refetchToken } = useQuery({
        queryKey: ['token', address],
        queryFn: async () => {
            const data = await fetchTokenData(address);
            if (data) registerRecentlyViewed(data);
            return data;
        },
        enabled: !!address && isMounted,
        refetchInterval: 30000,
        staleTime: 15000,
    });

    // Historical Chart Data
    const { data: initialData = [], isLoading: chartLoading } = useQuery({
        queryKey: ['chart-init', address, timeframe],
        queryFn: () => getInitialChartData(address, token?.priceUsd || 0, timeframe),
        enabled: !!token && isMounted,
        staleTime: 60000,
    });

    useEffect(() => {
        setIsMounted(true);
        const handleShowEnhance = () => setShowEnhanceModal(true);
        window.addEventListener('VORTEX_SHOW_ENHANCE', handleShowEnhance);
        return () => window.removeEventListener('VORTEX_SHOW_ENHANCE', handleShowEnhance);
    }, []);

    // Real-time Subscriptions
    useEffect(() => {
        if (!address || !isMounted) return;
        const unsubChart = subscribeToTokenChart(address, (tick: ChartTick) => {
            setRealtimeData(tick);
        });
        const unsubStream = subscribeToLiveStream(address, (tx: VortexTx) => {
            setTxs((prev: VortexTx[]) => [tx, ...prev].slice(0, 15));
        });
        return () => {
            unsubChart();
            unsubStream();
        };
    }, [address, isMounted]);

    // Add a mount check to prevent hard SSR mismatch loops during hydration
    if (!isMounted) return null;

    return (
        <div className="app-container">
            <GlobalNotification />

            <div className="vortex-container-centered">
                <main className="vortex-token-page">
                    {/* HUD Header - Always visible, skeletons if loading */}
                    <VortexPanel className="vortex-mb-4" glowColor="cyan">
                        {tokenLoading && !token ? (
                            <div className="vortex-flex-between vortex-px-4">
                                <div className="vortex-flex-start vortex-gap-4">
                                    <div className="vortex-logo-icon vortex-logo-md vortex-animate-pulse"></div>
                                    <div className="vortex-flex-column">
                                        <div className="vortex-skeleton vortex-h-6 vortex-w-32 vortex-mb-2"></div>
                                        <div className="vortex-skeleton vortex-h-4 vortex-w-48"></div>
                                    </div>
                                </div>
                                <div className="vortex-flex-column vortex-align-end">
                                    <div className="vortex-skeleton vortex-h-8 vortex-w-24 vortex-mb-2"></div>
                                    <div className="vortex-skeleton vortex-h-4 vortex-w-16"></div>
                                </div>
                            </div>
                        ) : token ? (
                            <div className="vortex-flex-between">
                                <div className="vortex-flex-start vortex-gap-4">
                                    <button className="vortex-btn-icon" onClick={() => router.push('/')} aria-label="Back to terminal">
                                        <ArrowLeft size={16} />
                                    </button>
                                    <div className="vortex-flex-start vortex-gap-4">
                                        {token.logoURI ? (
                                            <img src={token.logoURI} alt="" className="vortex-logo-md vortex-border-radius-full" />
                                        ) : (
                                            <div className="vortex-logo-icon vortex-logo-md"></div>
                                        )}
                                        <div className="vortex-flex-column">
                                            <div className="vortex-flex-start vortex-gap-3">
                                                <h1 className="vortex-card-title vortex-m-0 vortex-text-lg">{token.name} <span className="vortex-text-muted">({token.symbol})</span></h1>
                                                {token.tier === 'Elite' ? (
                                                    <span className="badge-vortex badge-verified"><ShieldCheck size={12} /> ELITE_VERIFIED</span>
                                                ) : token.tier === 'Enhanced' ? (
                                                    <span className="badge-vortex badge-safe text-vortex-cyan">ENHANCED_PROFILE</span>
                                                ) : (
                                                    <span className="badge-vortex vortex-bg-obsidian-soft text-vortex-muted border-vortex-muted">UNCLAIMED_ASSET</span>
                                                )}
                                            </div>
                                            <div className="vortex-flex-start vortex-gap-3 vortex-mt-1">
                                                <code className="vortex-text-tiny vortex-text-muted vortex-ls-tight">{token.address}</code>
                                                <button className="vortex-btn-tiny" onClick={() => { navigator.clipboard.writeText(token.address); notify('success', 'ADDRESS_COPIED_TO_CLIPBOARD'); }}>COPY</button>
                                                <a href={`https://solscan.io/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="vortex-btn-tiny"><ExternalLink size={10} /></a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="vortex-flex-column vortex-align-end">
                                    <div className="vortex-text-2xl vortex-font-bold text-vortex-cyan">{formatCurrency(token.priceUsd, 6)}</div>
                                    <div className={`${token.priceChange24h >= 0 ? 'text-vortex-yellow' : 'text-vortex-red'} vortex-text-sm vortex-text-bold`}>
                                        {token.priceChange24h >= 0 ? 'â–²' : 'â–¼'} {Math.abs(token.priceChange24h).toFixed(2)}% <span className="vortex-text-muted vortex-font-normal">(24h)</span>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </VortexPanel>

                    {token?.advancedMetrics?.transferFeeBps ? (
                        <div className="vortex-mb-4 vortex-p-4 vortex-bg-red vortex-bg-opacity-10 vortex-border vortex-border-vortex-red vortex-border-radius-md animate-pulse">
                            <div className="vortex-flex-start vortex-gap-3">
                                <ShieldAlert size={24} className="text-vortex-red" />
                                <div className="vortex-flex-column">
                                    <span className="vortex-text-lg vortex-text-red vortex-text-bold">CRITICAL: MALICIOUS_CONTRACT_DETECTED</span>
                                    <span className="vortex-text-sm vortex-text-muted">TOKEN2022 EXTENSION: A {((token.advancedMetrics.transferFeeBps || 0) / 100).toFixed(1)}% transfer tax is hardcoded into this asset. Swaps will incur massive penalties.</span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {token && token.tier === 'Basic' && (
                        <VortexPanel className="vortex-mb-4 vortex-border-dashed border-vortex-cyan vortex-bg-obsidian-soft animate-fade-in" glowColor="cyan">
                            <div className="vortex-flex-between">
                                <div className="vortex-flex-start vortex-gap-4">
                                    <div className="vortex-p-3 vortex-bg-vortex vortex-bg-opacity-20 text-vortex-cyan vortex-border-radius-full">
                                        <Zap size={24} className="vortex-animate-pulse" />
                                    </div>
                                    <div className="vortex-flex-column">
                                        <h3 className="vortex-text-lg vortex-text-bold text-vortex-cyan vortex-m-0">UNCLAIMED_TACTICAL_ASSET</h3>
                                        <p className="vortex-text-sm vortex-text-muted vortex-m-0 vortex-max-w-xl">
                                            This token profile is operating on basic telemetry. Claim ownership to inject permanent social routing, custom intel briefs, and unlock the Elite Security Badge on the global Vortex discovery network.
                                        </p>
                                    </div>
                                </div>
                                <VortexButton
                                    variant="primary"
                                    className="vortex-h-12 vortex-px-6 vortex-text-bold vortex-ls-wide"
                                    onClick={() => {
                                        if (!wallet.connected) {
                                            notify('error', 'WALLET_DISCONNECTED: Secure connection required to upgrade tier.');
                                            return;
                                        }
                                        setShowEnhanceModal(true);
                                    }}
                                >
                                    UPGRADE PROFILE
                                    <ArrowUpRight size={16} className="vortex-ml-2" />
                                </VortexButton>
                            </div>
                        </VortexPanel>
                    )}

                    {token && (
                        <div className="vortex-flex-column vortex-gap-3">
                            {/* Row 1: The Chart Engine */}
                            <div className="vortex-grid-inner">
                                <div className="vortex-col-span-8">
                                    <VortexPanel className="vortex-p-3 vortex-chart-h" glowColor="none">
                                        {chartLoading ? (
                                            <div className="vortex-full-size vortex-flex-column vortex-center text-vortex-muted">
                                                <Loader2 className="vortex-animate-spin vortex-mb-2" size={24} />
                                                <span className="vortex-text-tiny vortex-font-mono">ACQUIRING_DATA_STREAM...</span>
                                            </div>
                                        ) : (
                                            <TokenChart
                                                initialData={initialData}
                                                realtimeData={realtimeData}
                                                timeframe={timeframe}
                                                onTimeframeChange={setTimeframe}
                                            />
                                        )}
                                    </VortexPanel>
                                </div>

                                {/* Sidebar: Execution Zone */}
                                <div className="vortex-col-span-4 vortex-flex-column vortex-gap-6">
                                    <VortexPanel title="EXECUTE_SWAP" subTitle={`SOL <> ${token.symbol}`} glowColor="cyan">
                                        <div className="vortex-input-group vortex-mb-4">
                                            <div className="vortex-flex-between vortex-mb-1">
                                                <span className="vortex-text-tiny vortex-text-muted uppercase">Amount_SOL</span>
                                                <span className="vortex-text-tiny vortex-text-muted">Bal: 0.00</span>
                                            </div>
                                            <input type="number" className="vortex-input-field vortex-full-width" placeholder="0.0" />
                                        </div>
                                        <VortexButton
                                            className="vortex-full-width vortex-py-4 vortex-text-bold vortex-ls-wide"
                                            onClick={() => notify('success', 'SWAP_ROUTING_INITIATED')}
                                        >
                                            INITIALIZE_SWAP
                                        </VortexButton>
                                    </VortexPanel>

                                    <VortexPanel title="LIVE_TRANSACTIONS" subTitle="STREAM_ACTIVE" variant="glass" className="vortex-flex-1">
                                        <div className="vortex-tx-stream-container">
                                            {txs.length === 0 ? (
                                                <div className="vortex-p-8 vortex-text-center vortex-opacity-30">
                                                    <RefreshCcw size={24} className="vortex-m-auto vortex-mb-2 animate-spin" />
                                                    <p className="vortex-text-tiny">SYNCING_STREAM...</p>
                                                </div>
                                            ) : (
                                                txs.map((tx, idx) => (
                                                    // Use transaction signature directly as true unique key 
                                                    <div key={tx.signature} className="vortex-tx-item animate-fade-in vortex-flex-between">
                                                        <span className={tx.type === 'BUY' ? 'text-vortex-yellow' : 'text-vortex-red'}>
                                                            {tx.type} {tx.amountSol.toFixed(2)} SOL
                                                        </span>
                                                        <span className="vortex-text-muted vortex-text-tiny">
                                                            {tx.wallet.slice(0, 4)}...{tx.wallet.slice(-4)}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </VortexPanel>

                                    {wallet.connected && token.owner && wallet.publicKey?.toString() === token.owner && (
                                        <div className="vortex-flex-1">
                                            <DeveloperControlPanel
                                                token={token}
                                                onUpdate={refetchToken}
                                                notify={notify}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Row 2: Tactical Intelligence */}
                            <div className="vortex-grid-inner vortex-mt-6">
                                <div className="vortex-col-span-8">
                                    <div className="vortex-grid-2 vortex-gap-6">
                                        <BundlePanel token={token} onEnhance={() => setShowEnhanceModal(true)} />
                                        <VortexPanel title="VORTEX_VERDICT" subTitle={token.isSafe ? 'OPTIMAL' : 'DEGRADED_OPS'} glowColor="yellow">
                                            <div className="vortex-flex-between vortex-mb-4">
                                                <div className="vortex-text-center">
                                                    <div className="vortex-text-tiny vortex-text-muted">SECURITY</div>
                                                    <div className={`vortex-text-lg vortex-font-bold ${token.isSafe ? 'text-vortex-yellow' : 'text-vortex-loading'}`}>
                                                        {token.isSafe ? '98/100' : 'RISK_DETECTED'}
                                                    </div>
                                                </div>
                                                <div className="vortex-divider-v"></div>
                                                <div className="vortex-text-center">
                                                    <div className="vortex-text-tiny vortex-text-muted">SENTIMENT</div>
                                                    <div className={`vortex-text-lg vortex-font-bold ${token.advancedMetrics.socialSentiment?.score || 0 > 70 ? 'text-vortex-yellow' : 'text-vortex-cyan'}`}>
                                                        {token.advancedMetrics.socialSentiment?.hypeLevel || 'DORMANT'}
                                                    </div>
                                                </div>
                                                <div className="vortex-divider-v"></div>
                                                <div className="vortex-text-center">
                                                    <div className="vortex-text-tiny vortex-text-muted">LIQUIDITY</div>
                                                    <div className="vortex-text-lg vortex-font-bold text-vortex-bright">
                                                        {formatCompactLocal(token.liquidityUsd)}
                                                    </div>
                                                </div>
                                            </div>
                                        </VortexPanel>
                                    </div>
                                </div>
                                <div className="vortex-col-span-4">
                                    <VortexPanel title="TACTICAL_METRICS" className="vortex-full-height">
                                        <div className="vortex-metric-card">
                                            <span className="vortex-text-tiny vortex-text-muted">VOLUME_VELOCITY</span>
                                            <div className="vortex-flex-between vortex-mt-1">
                                                <span className="vortex-text-bright vortex-text-bold">{token.advancedMetrics?.volumeVelocity?.score || 0}</span>
                                                <span className={`vortex-text-tiny ${token.advancedMetrics?.volumeVelocity?.status === 'BREAKOUT' ? 'text-vortex-yellow' : 'vortex-text-muted'}`}>
                                                    {token.advancedMetrics?.volumeVelocity?.status || 'STABLE'}
                                                </span>
                                            </div>
                                            <div className="vortex-progress-bg vortex-progress-sm vortex-mt-1">
                                                <div
                                                    className={`vortex-progress-fill ${token.advancedMetrics?.volumeVelocity?.status === 'BREAKOUT' ? 'vortex-bg-green animate-pulse' : 'vortex-bg-cyan'}`}
                                                    style={{ width: `${Math.max(0, Math.min(100, token.advancedMetrics?.volumeVelocity?.score || 0))}%` }}
                                                />
                                            </div>
                                        </div>
                                    </VortexPanel>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
            <div className="vortex-no-capture">
                <MobileNav />
            </div>
        </div>
    );
}

const formatCompactLocal = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
    return val.toLocaleString();
};

export default function TokenClientPage({ params }: { params: Promise<{ address: string }> }) {
    const { address } = React.use(params);
    return (
        <Suspense fallback={<div className="vortex-fullscreen text-vortex-loading">SYNCING VORTEX PULSE...</div>}>
            <TokenDetailContent initialAddress={address} />
        </Suspense>
    );
}
