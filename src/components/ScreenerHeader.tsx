'use client';
import { Camera, RefreshCcw, ArrowUpRight, ExternalLink } from 'lucide-react';
import { TokenInfo, formatCurrency, formatCompact, formatPercent } from '@/lib/dataService';
import { TokenAvatar } from './TokenAvatar';

interface ScreenerHeaderProps {
    token: TokenInfo;
    refreshLoading: boolean;
    isCapturing: boolean;
    onRefresh: () => void;
    onCapture: () => void;
    onEnhance: () => void;
}
export function ScreenerHeader({ token, refreshLoading, isCapturing, onRefresh, onCapture, onEnhance }: ScreenerHeaderProps) {
    return <div className="vortex-screener-header-container">
        <div className="vortex-screener-top">
            <div className="vortex-token-identity"><TokenAvatar symbol={token.symbol} src={token.logoURI} /><div><h1>{token.symbol} <span className="vortex-pair-quote">/ USD</span></h1><p>{token.name} · Solana{token.tier && token.tier !== 'Basic' ? ' · ' + token.tier + ' paid profile' : ''}</p></div></div>
            <div className="vortex-token-actions vortex-no-capture"><button className="vortex-icon-btn" onClick={onRefresh} disabled={refreshLoading} aria-label="Refresh token data"><RefreshCcw size={16} className={refreshLoading ? 'vortex-refreshing' : ''} aria-hidden /></button><button className="btn-vortex btn-vortex-secondary" onClick={onCapture} disabled={isCapturing} aria-busy={isCapturing}><Camera size={16} aria-hidden />{isCapturing ? 'Saving…' : 'Snapshot'}</button><button className="btn-vortex btn-vortex-secondary" onClick={onEnhance}>Project profile <ArrowUpRight size={16} aria-hidden /></button></div>
        </div>
        <div className="vortex-token-price-row"><span className="vortex-token-price">{token.priceUsd > 0 ? formatCurrency(token.priceUsd) : 'Price unavailable'}</span><span className={token.priceChange24h >= 0 ? 'vortex-positive' : 'vortex-negative'}>{token.priceChange24h == null ? '—' : formatPercent(token.priceChange24h)}<small>24h</small></span><a className="vortex-mint-link" href={'https://solscan.io/token/' + token.address} target="_blank" rel="noreferrer" title={token.address}>{token.address.slice(0, 5)}…{token.address.slice(-5)}<ExternalLink size={12} aria-hidden /><span className="vortex-sr-only">View token on Solscan</span></a></div>
        <div className="vortex-token-stats">{[['Market cap', token.mcap > 0 ? '$' + formatCompact(token.mcap) : 'Unverified'], ['Liquidity', '$' + formatCompact(token.liquidityUsd)], ['24h volume', '$' + formatCompact(token.volume24h)], ['Fully diluted value', token.fdv > 0 ? '$' + formatCompact(token.fdv) : '—']].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </div>;
}
