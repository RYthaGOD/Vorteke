'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTokenData, formatCurrency, Timeframe, VortexTx, registerRecentlyViewed, getInitialChartData, subscribeToServerStream } from '@/lib/dataService';
import { ArrowLeft, ExternalLink, ShieldAlert, Loader2, Activity } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { useCaptureReport } from '@/hooks/useCaptureReport';
import { MobileNav } from '@/components/MobileNav';
import { BundlePanel } from '@/components/BundlePanel';
import { SwapPanel } from '@/components/SwapPanel';
import { DeveloperControlPanel } from '@/components/DeveloperControlPanel';
import { VortexPanel } from '@/components/DesignSystem';
import { ScreenerHeader } from '@/components/ScreenerHeader';
import { VortexVerdict } from '@/components/VortexVerdict';
import { TrendingStrip } from '@/components/TrendingStrip';
import { FeedStatus } from '@/components/FeedStatus';
import { useNotificationStore } from '@/lib/store';

const EnhancementModal = dynamic(() => import('@/components/EnhancementModal').then(m => m.EnhancementModal), { ssr: false });
const TokenChart = dynamic(() => import('@/components/TokenChart').then(mod => mod.TokenChart), { ssr: false, loading: () => <div className="vortex-empty" role="status"><Loader2 size={24} aria-hidden />Loading chart…</div> });

function TokenDetailContent({ initialAddress }: { initialAddress?: string }) {
    const { publicKey, connected, isElite } = useVortexAuth();
    const address = initialAddress || '';
    const [timeframe, setTimeframe] = useState<Timeframe>('1M');
    const [txs, setTxs] = useState<VortexTx[]>([]);
    const [showEnhanceModal, setShowEnhanceModal] = useState(false);
    const notify = useNotificationStore(state => state.notify);
    const market = useQuery({
        queryKey: ['token', address, publicKey?.toString()],
        queryFn: async () => {
            const token = await fetchTokenData(address, publicKey?.toString());
            if (!token) throw new Error('Token unavailable');
            registerRecentlyViewed(token);
            return token;
        },
        enabled: !!address, refetchInterval: 60000, staleTime: 30000,
    });
    // Price polling stays independent of slower metadata and holder checks.
    const prices = useQuery<{ price: number; change: number | null; source: string; cacheSeconds: number }>({
        queryKey: ['token-price', address],
        queryFn: async ({ signal }) => {
            const response = await fetch('/api/proxy/jup-price?ids=' + encodeURIComponent(address), { signal });
            if (!response.ok) throw new Error('Price provider unavailable');
            const body = await response.json();
            const data = body.data?.[address];
            const price = Number(data?.price);
            if (!Number.isFinite(price) || price <= 0) throw new Error('No market quote');
            return { price, change: Number.isFinite(data.priceChange24h) ? data.priceChange24h : null, source: body.source || 'Market provider', cacheSeconds: body.cacheSeconds || 60 };
        },
        enabled: !!address, refetchInterval: query => query.state.data?.source === 'GeckoTerminal' ? 60000 : isElite ? 5000 : 15000, staleTime: 5000, retry: 1,
    });
    const latestTx = txs[0];
    const priceUpdatedAt = Math.max(market.dataUpdatedAt, prices.dataUpdatedAt);
    const quotedToken = market.data && prices.data && prices.dataUpdatedAt >= market.dataUpdatedAt
        ? { ...market.data, priceUsd: prices.data.price, priceChange24h: prices.data.change ?? market.data.priceChange24h } : market.data;
    const token = quotedToken && latestTx?.priceUsd && latestTx.priceUsd > 0 && latestTx.blockTime * 1000 > priceUpdatedAt
        ? { ...quotedToken, priceUsd: latestTx.priceUsd } : quotedToken;
    const { captureReport, isCapturing } = useCaptureReport('tactical-recon-grid', (token?.symbol || 'TOKEN') + '_MARKET');
    const chart = useQuery({
        queryKey: ['chart-init', address, timeframe],
        queryFn: () => getInitialChartData(address, token?.priceUsd || 0, timeframe),
        enabled: !!token, staleTime: 60000, refetchInterval: 60000,
    });
    useEffect(() => {
        const show = () => setShowEnhanceModal(true);
        window.addEventListener('VORTEX_SHOW_ENHANCE', show);
        return () => window.removeEventListener('VORTEX_SHOW_ENHANCE', show);
    }, []);
    useEffect(() => {
        setTxs([]);
        if (!address) return;
        return subscribeToServerStream(address, false, (event: VortexTx & { kind?: string }) => {
            if (event.kind !== 'tx' || !event.signature || !['BUY', 'SELL'].includes(event.type) || !Number.isFinite(event.blockTime)) return;
            setTxs(previous => previous.some(tx => tx.signature === event.signature) ? previous : [event, ...previous].sort((a, b) => b.blockTime - a.blockTime).slice(0, 50));
        });
    }, [address]);
    const refresh = () => { void market.refetch(); void prices.refetch(); void chart.refetch(); };
    const safeSocials = Object.entries(token?.socials || {}).filter(([, url]) => typeof url === 'string' && /^https:\/\//i.test(url));
    return <main id="main-content" className="vortex-app-root">
        <div className="vortex-container-centered"><div className="vortex-token-page">
            <div className="vortex-token-breadcrumb"><Link href="/terminal"><ArrowLeft size={16} aria-hidden />Back to markets</Link><FeedStatus updatedAt={priceUpdatedAt} fetching={prices.isFetching || market.isFetching} error={prices.isError || market.isError} /></div>
            {!token ? <VortexPanel glowColor="none"><div className="vortex-empty" role={market.isError ? 'alert' : 'status'}>{market.isError || !address ? <><ShieldAlert size={32} aria-hidden /><h2>Token unavailable</h2><p>Check the mint address or retry the data provider.</p><button className="btn-vortex btn-vortex-primary" onClick={() => market.refetch()}>Retry</button></> : <><div className="vortex-market-skeleton vortex-full-width" /><p>Loading token data…</p></>}</div></VortexPanel> : <>
                <VortexPanel className="vortex-mb-4" glowColor="none"><ScreenerHeader token={token} refreshLoading={market.isFetching || prices.isFetching} isCapturing={isCapturing} onRefresh={refresh} onCapture={captureReport} onEnhance={() => setShowEnhanceModal(true)} /></VortexPanel>
                {token.advancedMetrics?.transferFeeBps ? <p className="vortex-inline-notice"><ShieldAlert size={16} aria-hidden /> This token charges a {(token.advancedMetrics.transferFeeBps / 100).toFixed(1)}% transfer fee. Review the quoted output before trading.</p> : null}
                <div id="tactical-recon-grid" className="vortex-flex-column vortex-gap-4">
                    <div className="vortex-grid-inner">
                        <div className="vortex-col-span-8">
                            <VortexPanel className="vortex-p-0 vortex-chart-h" glowColor="none">
                                {chart.isLoading ? <div className="vortex-empty" role="status"><Activity size={24} aria-hidden /><h2>Loading price history</h2><p>Fetching on-chain candles for this token.</p></div> : <TokenChart key={address + timeframe} address={address} initialData={chart.data || []} realtimeTx={latestTx || null} timeframe={timeframe} onTimeframeChange={setTimeframe} />}
                            </VortexPanel>
                            <p className="vortex-disclosure">{prices.isError && "Fast price updates are unavailable; showing the last market snapshot. "}{prices.data?.source === 'GeckoTerminal' ? 'GeckoTerminal market snapshots refresh every 60s.' : 'Jupiter quotes refresh every ' + (isElite ? '5' : '15') + 's.'} Provider caching can add delay. Candles refresh every minute. Recent trades appear when the upstream stream delivers them.</p>
                            <div className="vortex-grid-2 vortex-gap-4 vortex-mt-4">
                                <BundlePanel token={token} onEnhance={() => setShowEnhanceModal(true)} />
                                <VortexPanel title="Token checks" subTitle="On-chain context" glowColor="none"><dl className="vortex-check-list">{[['Mint authority', token.advancedMetrics?.mintAuthority], ['Freeze authority', token.advancedMetrics?.freezeAuthority], ['LP signal (heuristic)', token.advancedMetrics?.lpBurnStatus], ['Top 10 holders', token.advancedMetrics?.top10HolderPercent != null ? token.advancedMetrics.top10HolderPercent.toFixed(1) + '%' : null]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Unavailable'}</dd></div>)}</dl><p className="vortex-disclosure">Checks provide context, not a guarantee of safety.</p></VortexPanel>
                            </div>
                        </div>
                        <div className="vortex-col-span-4 vortex-flex-column vortex-gap-4">
                            <SwapPanel token={token} notify={notify} />
                            <VortexPanel title="Recent trades" subTitle={txs.length ? 'On-chain events' : 'Waiting for trades'} glowColor="none">
                                {txs.length ? <ul className="vortex-trades-list">{txs.map(tx => <li key={tx.signature}><span className={tx.type === 'BUY' ? 'vortex-positive' : 'vortex-negative'}>{tx.type}</span><span>{tx.priceUsd && tx.priceUsd > 0 ? formatCurrency(tx.priceUsd) : '—'}</span><a href={'https://solscan.io/tx/' + tx.signature} target="_blank" rel="noreferrer" aria-label={'View ' + tx.type.toLowerCase() + ' transaction on Solscan'}>{new Date(tx.blockTime * 1000).toLocaleTimeString()}<ExternalLink size={12} aria-hidden /></a></li>)}</ul> : <div className="vortex-empty"><Activity size={24} aria-hidden /><p>No trades received yet. An idle feed does not mean the token has no trading activity.</p></div>}
                            </VortexPanel>
                            {connected && token.owner === publicKey?.toString() && <DeveloperControlPanel token={token} onUpdate={market.refetch} notify={notify} />}
                        </div>
                    </div>
                    {(token.customDescription || token.bannerURI || safeSocials.length > 0) && <VortexPanel title="About this project" subTitle="Project-supplied information" glowColor="none">
                        {token.bannerURI && /^(https:\/\/|\/images\/tokens\/)/i.test(token.bannerURI) && <Image width={1500} height={500} unoptimized src={token.bannerURI} alt={token.symbol + ' project banner'} className="vortex-project-banner" />}
                        {token.customDescription && <p className="vortex-project-description">{token.customDescription}</p>}
                        <div className="vortex-project-links">{safeSocials.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">{name}<ExternalLink size={14} aria-hidden /></a>)}</div>
                    </VortexPanel>}
                    {txs.length > 0 && <VortexVerdict token={token} recentTxs={txs} />}
                </div>
            </>}
            <TrendingStrip />
        </div></div>
        <MobileNav />
        {showEnhanceModal && address && <EnhancementModal address={address} onClose={() => setShowEnhanceModal(false)} onPurchase={() => market.refetch()} notify={notify} />}
    </main>;
}
export default function TokenClientPage({ address }: { address?: string }) {
    return <Suspense fallback={<main id="main-content" className="vortex-workspace" role="status">Loading token…</main>}><TokenDetailContent key={address} initialAddress={address} /></Suspense>;
}
