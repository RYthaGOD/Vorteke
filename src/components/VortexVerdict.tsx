'use client';
import React from 'react';
import { Target, AlertCircle, CheckCircle2, Zap, TrendingUp, ShieldAlert } from 'lucide-react';
import { TokenInfo, VortexTx } from '@/lib/dataService';
import { VortexPanel } from '@/components/DesignSystem';

interface VortexVerdictProps {
    token: TokenInfo;
    recentTxs: VortexTx[];
}

export function VortexVerdict({ token, recentTxs }: VortexVerdictProps) {
    // Mission Calculus Logic (Alpha)
    const whaleBuys = recentTxs.filter(tx => tx.type === 'BUY' && tx.amountSol > 10).length;
    const devSells = recentTxs.filter(tx => tx.labels?.includes('DEV_DUMP')).length;
    const bundleRisk = token.advancedMetrics?.holderIntelligence?.riskLevel || 'LOW';
    const velocityStatus = token.advancedMetrics?.marketVelocity?.activityLevel || 'STABLE';
    const lpStatus = token.advancedMetrics?.lpBurnStatus || 'unverified';

    let verdict = 'NEUTRAL';
    let summary = 'Awaiting further forensic on-chain confirmation.';
    let color: 'cyan' | 'yellow' | 'none' = 'cyan';
    let textColor = 'text-vortex-cyan';

    if (devSells > 0) {
        verdict = 'AVOID';
        summary = 'Dev wallet dump detected. High rug risk identified via trade trace.';
        color = 'none';
        textColor = 'text-vortex-red';
    } else if (bundleRisk === 'HIGH' || lpStatus === 'unverified') {
        verdict = 'CAUTION';
        summary = lpStatus === 'unverified'
            ? 'LP lock not verified on-chain. Counterparty risk detected.'
            : 'High launch block concentration. Potential sniper exit pending.';
        color = 'none';
        textColor = 'text-vortex-red';
    } else if (whaleBuys > 2 && velocityStatus === 'VOLATILE') {
        verdict = 'BULLISH';
        summary = 'Whale accumulation + high velocity signal detected.';
        color = 'yellow';
        textColor = 'text-vortex-yellow';
    } else if (token.tier === 'Elite') {
        verdict = 'STABLE';
        summary = 'Verified Elite asset with organic liquidity footprint.';
        color = 'cyan';
        textColor = 'text-vortex-cyan';
    }

    return (
        <VortexPanel title="VORTEX_VERDICT" subTitle={verdict} glowColor={color}>
            <div className="vortex-flex-column vortex-gap-4">
                <div className="vortex-p-3 vortex-bg-obsidian-soft vortex-border-radius-md">
                    <p className="vortex-text-sm vortex-text-muted vortex-m-0">
                        <span className={`vortex-text-bold ${textColor}`}>FORENSIC_ANALYSIS:</span> {summary}
                    </p>
                </div>

                <div className="vortex-grid-4 vortex-gap-3">
                    <div className="vortex-flex-column vortex-center">
                        <Zap size={16} className={whaleBuys > 0 ? 'text-vortex-yellow' : 'text-vortex-muted'} />
                        <span className="vortex-text-tiny vortex-mt-2">WHALE_PULSE</span>
                        <span className="vortex-text-xs vortex-text-extrabold">{whaleBuys} BUYS</span>
                    </div>
                    <div className="vortex-flex-column vortex-center">
                        <ShieldAlert size={16} className={bundleRisk === 'HIGH' ? 'text-vortex-red' : 'text-vortex-yellow'} />
                        <span className="vortex-text-tiny vortex-mt-2">BUNDLE_RISK</span>
                        <span className="vortex-text-xs vortex-text-extrabold">{bundleRisk}</span>
                    </div>
                    <div className="vortex-flex-column vortex-center">
                        <CheckCircle2 size={16} className={lpStatus === 'verified' ? 'text-vortex-cyan' : 'text-vortex-red'} />
                        <span className="vortex-text-tiny vortex-mt-2">LP_STATUS</span>
                        <span className="vortex-text-xs vortex-text-extrabold">{lpStatus.toUpperCase()}</span>
                    </div>
                    <div className="vortex-flex-column vortex-center">
                        <TrendingUp size={16} className={velocityStatus === 'VOLATILE' ? 'text-vortex-yellow' : 'text-vortex-muted'} />
                        <span className="vortex-text-tiny vortex-mt-2">VELOCITY</span>
                        <span className="vortex-text-xs vortex-text-extrabold">{velocityStatus}</span>
                    </div>
                </div>
            </div>
        </VortexPanel>
    );
}
