'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { getDiscoveryList, fetchTokenData, resolveSearch, getQuickRecon, getUserPortfolio, getRecentlyViewed, TokenInfo, formatCurrency, formatCompact, formatPercent, Timeframe, ChartTick, VortexTx, registerRecentlyViewed, getInitialChartData, subscribeToTokenChart, subscribeToLiveStream } from '@/lib/dataService';
import {
    ArrowLeft, X, ExternalLink, Zap, ShieldAlert, Globe, Cpu, Users, Info, Settings, Activity, RefreshCcw, ShieldCheck, Check, TrendingUp, Layers, AlertTriangle, Camera, Send, Loader2, ArrowUpRight, Lock
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { useCaptureReport } from '@/hooks/useCaptureReport';
import { MobileNav } from '@/components/MobileNav';
import { GlobalNotification } from '@/components/GlobalNotification';
import { BundlePanel } from '@/components/BundlePanel';
import { SwapPanel } from '@/components/SwapPanel';
import { DeveloperControlPanel } from '@/components/DeveloperControlPanel';
import { VortexPanel, VortexButton } from '@/components/DesignSystem';
import { ScreenerHeader } from '@/components/ScreenerHeader';
import { VortexVerdict } from '@/components/VortexVerdict';
import { useNotificationStore } from '@/lib/store';

const EnhancementModal = dynamic(() => import('@/components/EnhancementModal').then(m => m.EnhancementModal), { ssr: false });

const TokenChart = dynamic(() => import('@/components/TokenChart').then(mod => mod.TokenChart), {
    ssr: false,
    loading: () => (
        <div className="vortex-full-size vortex-relative vortex-bg-obsidian vortex-flex-column vortex-center overflow-hidden">
            <div className="vortex-hud-scanner"></div>
            <div className="vortex-flex-column vortex-center vortex-z-10">
                <Loader2 className="vortex-animate-spin vortex-mb-2 text-vortex-cyan" size={24} />
                <span className="vortex-text-tiny vortex-font-mono text-vortex-cyan animate-pulse">INITIALIZING_CANVAS_ENGINE...</span>
            </div>
        </div>
    ),
});

function TokenDetailContent({ initialAddress }: { initialAddress?: string }) {
    const router = useRouter();
    const { publicKey, connected, isElite } = useVortexAuth();
    const wallet = { publicKey, connected }; // legacy compat
    const address = initialAddress || '';
    const [timeframe, setTimeframe] = useState<Timeframe>('1M');
    const [realtimeData, setRealtimeData] = useState<ChartTick | null>(null);
    const [txs, setTxs] = useState<VortexTx[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const [showEnhanceModal, setShowEnhanceModal] = useState(false);
    const [rpcLatency, setRpcLatency] = useState(42); // will be updated on first fetch

    const notify = useNotificationStore((state) => state.notify);

    // Primary Data Reconnaissance
    const { data: token, isLoading: tokenLoading, error, refetch: refetchToken } = useQuery({
        queryKey: ['token', address, publicKey?.toString()],
        queryFn: async () => {
            const t0 = Date.now();
            const data = await fetchTokenData(address, publicKey?.toString());
            // H1 FIX: Compute live latency from actual data fetch duration
            setRpcLatency(Date.now() - t0);
            if (data) registerRecentlyViewed(data);
            return data;
        },
        enabled: !!address && isMounted,
        refetchInterval: isElite ? 5000 : 15000,
        staleTime: 5000,
    });

    const { captureReport, isCapturing } = useCaptureReport('tactical-recon-grid', `${token?.symbol || 'TOKEN'}_RECON`);

    // Historical Chart Data
    const { data: initialData = [], isLoading: chartLoading } = useQuery({
        queryKey: ['chart-init', address, timeframe],
        queryFn: () => getInitialChartData(address, token?.priceUsd || 0, timeframe),
        enabled: !!token && isMounted,
        staleTime: 10000, // Reduced from 60s for higher fidelity on switch
    });

    useEffect(() => {
        setIsMounted(true);
        const handleShowEnhance = () => setShowEnhanceModal(true);
        window.addEventListener('VORTEX_SHOW_ENHANCE', handleShowEnhance);
        return () => window.removeEventListener('VORTEX_SHOW_ENHANCE', handleShowEnhance);
    }, []);

    // Real-time Subscriptions: UNIFIED TRUTH PIPE
    useEffect(() => {
        if (!address || !isMounted) return;

        // We no longer call subscribeToTokenChart (the polling logic).
        // The chart is now driven strictly by the transaction stream in the next unsub block.

        const unsubStream = subscribeToLiveStream(address, (tx: VortexTx) => {
            setTxs((prev: VortexTx[]) => [tx, ...prev].slice(0, 50));
            // No need to setRealtimeData here, the ChartEngine now watches txs[0] directly
        });

        return () => {
            unsubStream();
        };
    }, [address, isMounted]);

    // Add a mount check to prevent hard SSR mismatch loops during hydration
    if (!isMounted) return null;

    // Tactical Failure Recovery Layer
    if (error && !token) {
        return (
            <div className="app-container">
                <div className="vortex-container-centered">
                    <VortexPanel className="vortex-p-8 vortex-center-column" glowColor="none">
                        <ShieldAlert className="vortex-text-red vortex-mb-4" size={48} />
                        <h2 className="vortex-h2 vortex-mb-2">UPLINK_FAILURE</h2>
                        <p className="vortex-text-muted vortex-mb-6">The neural mesh is struggling to resolve this asset. This is likely due to RPC rate limiting.</p>
                        <VortexButton onClick={() => refetchToken()}>RETRY_CONNECTION</VortexButton>
                    </VortexPanel>
                </div>
                <MobileNav />
            </div>
        );
    }

    return (
        <div className={`vortex-app-root ${isElite ? 'vortex-tier-elite' : ''}`}>
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
                            <ScreenerHeader
                                token={token}
                                telemetry={{
                                    rpcHealth: rpcLatency < 800 ? 'OPTIMAL' : rpcLatency < 2000 ? 'DEGRADED' : 'DARK',
                                    provider: 'VORTEX_DAEMON_RPC',
                                    latency: rpcLatency,
                                    tier: isElite ? 'ELITE' : 'BASIC'
                                }}
                                refreshLoading={tokenLoading}
                                isCapturing={isCapturing}
                                onRefresh={refetchToken}
                                onCapture={captureReport}
                                onEnhance={() => setShowEnhanceModal(true)}
                                isElite={isElite}
                            />
                        ) : null}
                    </VortexPanel>

                    {/* C1 Fix: High-fidelity Profile Banner */}
                    {token?.bannerURI && (
                        <VortexPanel className="vortex-mb-4 vortex-p-0 overflow-hidden vortex-banner-h" glowColor="cyan">
                            <img
                                src={token.bannerURI}
                                alt={`${token.symbol} Official Banner`}
                                className="vortex-image-cover vortex-full-size"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        </VortexPanel>
                    )}

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
                        <div className="vortex-flex-column vortex-gap-3" id="tactical-recon-grid">
                            {/* Row 1: The Chart Engine */}
                            <div className="vortex-grid-inner">
                                <div className="vortex-col-span-8">
                                    <VortexPanel className="vortex-p-0 vortex-chart-h vortex-relative" glowColor="none">
                                        <div className="vortex-precision-label">
                                            <div className={`vortex-precision-status ${isElite ? 'status-high-fidelity animate-pulse' : 'status-reduced'}`}></div>
                                            <span className={`vortex-text-tiny vortex-font-mono ${isElite ? 'text-high-fidelity' : 'vortex-text-muted'}`}>
                                                {isElite ? 'PRIORITY_UPLINK (5s)' : 'STANDARD_UPLINK (15s)'}
                                            </span>
                                        </div>
                                        {chartLoading ? (
                                            <div className="vortex-full-size vortex-relative vortex-bg-obsidian vortex-flex-column vortex-center overflow-hidden">
                                                <div className="spectral-shimmer"></div>
                                                <div className="vortex-flex-column vortex-center vortex-z-10">
                                                    <Loader2 className="vortex-animate-spin vortex-mb-2 text-vortex-yellow" size={24} />
                                                    <span className="vortex-text-tiny vortex-font-mono text-vortex-yellow">
                                                        SYNCING_ONCHAIN_STATE... [NETWORK_LOCKED]
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <TokenChart
                                                address={address}
                                                initialData={initialData}
                                                realtimeTx={txs[0] || null}
                                                timeframe={timeframe}
                                                onTimeframeChange={setTimeframe}
                                            />
                                        )}
                                    </VortexPanel>
                                </div>

                                {/* Sidebar: Execution Zone */}
                                <div className="vortex-col-span-4 vortex-flex-column vortex-gap-4">
                                    <SwapPanel token={token} notify={notify} />

                                    <VortexPanel title="LIVE_TRANSACTIONS" subTitle="STREAM_ACTIVE" variant="glass" className="vortex-flex-1">
                                        <div className="vortex-tx-stream-container">
                                            {txs.length === 0 ? (
                                                <div className="vortex-p-4 vortex-text-center vortex-opacity-30">
                                                    <RefreshCcw size={20} className="vortex-m-auto vortex-mb-2 animate-spin" />
                                                    <p className="vortex-text-tiny uppercase">Syncing_Feed...</p>
                                                </div>
                                            ) : (
                                                txs.map((tx, idx) => (
                                                    <div key={tx.signature} className="vortex-tx-item animate-fade-in vortex-flex-between">
                                                        <div className="vortex-flex-column">
                                                            <span className={tx.type === 'BUY' ? 'text-vortex-yellow' : 'text-vortex-red'}>
                                                                {tx.type} {tx.amountSol.toFixed(2)} SOL
                                                            </span>
                                                            {tx.priceUsd && (
                                                                <span className="vortex-text-tiny vortex-text-muted">
                                                                    @{formatCurrency(tx.priceUsd)}
                                                                </span>
                                                            )}
                                                        </div>
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
                            <div className="vortex-grid-inner vortex-mt-3">
                                <div className="vortex-col-span-8">
                                    <div className="vortex-grid-2 vortex-gap-4">
                                        <BundlePanel token={token} onEnhance={() => setShowEnhanceModal(true)} />
                                        <VortexPanel title="VORTEX_VERDICT" subTitle={token.isSafe ? 'OPTIMAL' : 'DEGRADED_OPS'} glowColor="yellow">
                                            <div className="vortex-flex-between vortex-mb-4">
                                                <div className="vortex-text-center">
                                                    <div className="vortex-text-tiny vortex-text-muted">SCAN_STATUS</div>
                                                    <div className={`vortex-text-lg vortex-font-bold ${token.isSafe ? 'text-vortex-yellow' : 'text-vortex-red'}`}>
                                                        {token.isSafe ? 'OPTIMAL' : 'RISK_DETECTED'}
                                                    </div>
                                                </div>
                                                <div className="vortex-divider-v"></div>
                                                <div className="vortex-text-center vortex-relative">
                                                    <div className="vortex-text-tiny vortex-text-muted">VELOCITY_PULSE</div>
                                                    <div className={`vortex-text-lg vortex-font-bold ${token.advancedMetrics.marketVelocity?.score || 0 > 70 ? 'text-vortex-yellow' : 'text-vortex-cyan'}`}>
                                                        {token.advancedMetrics.marketVelocity?.activityLevel || 'DORMANT'}
                                                    </div>
                                                </div>
                                                <div className="vortex-divider-v"></div>
                                                <div className="vortex-text-center">
                                                    <div className="vortex-text-tiny vortex-text-muted">LIQUIDITY</div>
                                                    <div className="vortex-text-lg vortex-font-bold text-vortex-bright">
                                                        {formatCompact(token.liquidityUsd)}
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

                                        {/* Project Intel Brief (Enhanced Only) */}
                                        {token.customDescription && (
                                            <div className="vortex-mt-6 vortex-p-4 vortex-intel-brief vortex-border-radius-sm">
                                                <div className="vortex-intel-title vortex-mb-2">PROJECT_INTEL_BRIEF</div>
                                                <p className="vortex-text-xs vortex-text-muted leading-relaxed">
                                                    {token.customDescription}
                                                </p>
                                            </div>
                                        )}

                                        <div className="vortex-metric-card vortex-mt-4 vortex-relative">
                                            <span className="vortex-text-tiny vortex-text-muted">HOLDER_CONCENTRATION</span>
                                            <div className="vortex-flex-between vortex-mt-1">
                                                <span className="vortex-text-bright vortex-text-bold">{token.advancedMetrics?.top10HolderPercent || 0}%</span>
                                                <span className={`vortex-text-tiny ${token.advancedMetrics?.holderIntelligence?.riskLevel === 'HIGH' ? 'text-vortex-red' : token.advancedMetrics?.holderIntelligence?.riskLevel === 'MEDIUM' ? 'text-vortex-yellow' : 'vortex-text-muted'}`}>
                                                    TOP_10_SUPPLY
                                                </span>
                                            </div>
                                            <div className="vortex-progress-bg vortex-progress-sm vortex-mt-1">
                                                <div
                                                    className={`vortex-progress-fill ${token.advancedMetrics?.holderIntelligence?.riskLevel === 'HIGH' ? 'vortex-bg-red' : token.advancedMetrics?.holderIntelligence?.riskLevel === 'MEDIUM' ? 'vortex-bg-yellow' : 'vortex-bg-cyan'}`}
                                                    style={{ width: `${Math.max(0, Math.min(100, token.advancedMetrics?.top10HolderPercent || 0))}%` }}
                                                />
                                            </div>
                                        </div>
                                    </VortexPanel>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VORTEX VERDICT — Tactical Signal Panel */}
                    {token && txs.length > 0 && (
                        <div className="vortex-container-centered vortex-mt-4">
                            <VortexVerdict token={token} recentTxs={txs} />
                        </div>
                    )}
                </main>
            </div>
            <div className="vortex-no-capture">
                <MobileNav />
            </div>
        </div >
    );
}

export default function TokenClientPage({ address }: { address?: string }) {
    return (
        <Suspense fallback={<div className="vortex-fullscreen text-vortex-loading">SYNCING VORTEX PULSE...</div>}>
            <TokenDetailContent initialAddress={address} />
        </Suspense>
    );
}
