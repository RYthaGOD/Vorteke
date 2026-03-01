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
    const volumeStatus = token.advancedMetrics?.volumeVelocity?.status || 'STABLE';

    let verdict = 'NEUTRAL';
    let summary = 'Awaiting further on-chain confirmation.';
    let color: 'cyan' | 'yellow' | 'none' = 'cyan';
    let textColor = 'text-vortex-cyan';

    if (devSells > 0) {
        verdict = 'AVOID';
        summary = 'Dev wallet dump detected. High rug risk.';
        color = 'none'; // 'red' isn't supported yet in standard panel
        textColor = 'text-vortex-red';
    } else if (bundleRisk === 'HIGH') {
        verdict = 'CAUTION';
        summary = 'High launch block concentration. Potential sniper exit pending.';
        color = 'none';
        textColor = 'text-vortex-red';
    } else if (whaleBuys > 3 && volumeStatus === 'BREAKOUT') {
        verdict = 'BULLISH';
        summary = 'Whale accumulation + breakout volume detected.';
        color = 'yellow';
        textColor = 'text-vortex-yellow';
    } else if (token.tier === 'Elite') {
        verdict = 'STABLE';
        summary = 'Verified Elite asset with organic signal flow.';
        color = 'cyan';
        textColor = 'text-vortex-cyan';
    }

    return (
        <VortexPanel title="VORTEX_VERDICT" subTitle={verdict} glowColor={color}>
            <div className="vortex-flex-column vortex-gap-4">
                <div className="vortex-p-3 vortex-bg-obsidian-soft vortex-border-radius-md">
                    <p className="vortex-text-sm vortex-text-muted vortex-m-0">
                        <span className={`vortex-text-bold ${textColor}`}>RECON_ANALYSIS:</span> {summary}
                    </p>
                </div>

                <div className="vortex-grid-3 vortex-gap-3">
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
                        <TrendingUp size={16} className={volumeStatus === 'BREAKOUT' ? 'text-vortex-yellow' : 'text-vortex-muted'} />
                        <span className="vortex-text-tiny vortex-mt-2">MOMENTUM</span>
                        <span className="vortex-text-xs vortex-text-extrabold">{volumeStatus}</span>
                    </div>
                </div>
            </div>
        </VortexPanel>
    );
}
