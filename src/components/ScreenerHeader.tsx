'use client';
import React from 'react';
import { Camera, RefreshCcw, Zap, ShieldCheck } from 'lucide-react';
import { TokenInfo, formatCurrency } from '@/lib/dataService';

interface ScreenerHeaderProps {
    token: TokenInfo;
    telemetry: {
        rpcHealth: 'OPTIMAL' | 'DEGRADED' | 'DARK';
        provider: string;
        latency: number;
    };
    refreshLoading: boolean;
    isCapturing: boolean;
    onRefresh: () => void;
    onCapture: () => void;
    onEnhance: () => void;
}

export const ScreenerHeader = React.memo(({
    token,
    telemetry,
    refreshLoading,
    isCapturing,
    onRefresh,
    onCapture,
    onEnhance
}: ScreenerHeaderProps) => {
    return (
        <div className="vortex-flex-between vortex-w-full">
            <div className="vortex-flex-start vortex-gap-6">
                <div className="vortex-flex-start vortex-gap-4">
                    {token.logoURI ? (
                        <img src={token.logoURI} alt={token.name} className="vortex-logo-md vortex-border-radius-full" />
                    ) : (
                        <div className="vortex-logo-icon vortex-logo-md"></div>
                    )}
                    <div className="vortex-flex-column">
                        <div className="vortex-flex-start vortex-gap-2">
                            <h1 className="vortex-card-title vortex-text-lg vortex-m-0">{token.name}</h1>
                            <span className="vortex-tagline">{token.symbol}</span>
                            {token.tier === 'Elite' && (
                                <span className="badge-vortex badge-pro vortex-flex-start vortex-gap-1">
                                    <Zap size={10} className="text-vortex-cyan" /> ELITE
                                </span>
                            )}
                            {token.tier === 'Enhanced' && (
                                <span className="badge-vortex badge-verified vortex-flex-start vortex-gap-1">
                                    <ShieldCheck size={10} className="text-vortex-cyan" /> VERIFIED
                                </span>
                            )}
                        </div>
                        <div className="vortex-flex-start vortex-gap-3 vortex-mt-1">
                            <span className="vortex-text-lg vortex-text-bold vortex-font-mono text-vortex-yellow">{formatCurrency(token.priceUsd)}</span>
                            <span className={`vortex-text-tiny vortex-font-mono vortex-text-bold ${token.priceChange24h > 0 ? 'text-vortex-yellow' : 'text-vortex-red'}`}>
                                {token.priceChange24h > 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>

                <div className="vortex-flex-start vortex-gap-3 vortex-border-left vortex-border-muted vortex-pl-4 vortex-no-capture">
                    <div className="vortex-flex-column">
                        <span className="vortex-label vortex-text-tiny vortex-m-0">RPC_UPLINK</span>
                        <span className="vortex-text-xs vortex-text-mono text-vortex-cyan">{telemetry.latency}ms</span>
                    </div>
                    <div className="vortex-flex-column">
                        <span className="vortex-label vortex-text-tiny vortex-m-0">NODE_STATUS</span>
                        <span className={`vortex-text-xs vortex-text-mono ${telemetry.rpcHealth === 'OPTIMAL' ? 'text-vortex-yellow' : 'text-vortex-red'}`}>
                            {telemetry.rpcHealth}
                        </span>
                    </div>
                </div>
            </div>

            <div className="vortex-flex-start vortex-gap-3 vortex-no-capture">
                <div className="vortex-flex-start vortex-gap-2">
                    <button
                        className="btn-vortex btn-vortex-sm btn-vortex-icon-only"
                        onClick={onRefresh}
                        disabled={refreshLoading}
                        title="RECALIBRATE_TELEMETRY"
                    >
                        <RefreshCcw size={14} className={refreshLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        className={`btn-vortex btn-vortex-sm ${isCapturing ? 'vortex-bg-purple animate-pulse' : 'btn-vortex-outline-purple'}`}
                        onClick={onCapture}
                        title="GENERATE_RECON_REPORT"
                    >
                        <Camera size={14} className="vortex-mr-2" />
                        {isCapturing ? 'CAPTURING...' : 'CAPTURE'}
                    </button>
                    {token.tier !== 'Elite' && (
                        <button
                            className={`btn-vortex btn-vortex-sm ${token.tier === 'Enhanced' ? 'btn-vortex-primary vortex-bg-purple' : 'btn-vortex-primary'}`}
                            onClick={onEnhance}
                        >
                            <Zap size={14} className={`vortex-mr-2 ${token.tier === 'Enhanced' ? 'text-vortex-white' : ''}`} />
                            {token.tier === 'Enhanced' ? 'UPGRADE_TO_ELITE' : 'VERIFY_TOKEN'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

ScreenerHeader.displayName = 'ScreenerHeader';
