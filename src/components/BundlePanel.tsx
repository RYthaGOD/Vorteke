'use client';
import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { TokenInfo } from '@/lib/dataService';

interface BundlePanelProps {
    token: TokenInfo;
    onEnhance: () => void;
}

import { VortexPanel, VortexButton } from '@/components/DesignSystem';
import { DeepScanModal } from './DeepScanModal';

export function BundlePanel({ token, onEnhance }: BundlePanelProps) {
    const [showDeepScan, setShowDeepScan] = useState(false);
    // TACTICAL_FIX: Map "Clustering signal" to sniper-specific volume instead of generic holder clusters
    const bundleRisk = token.advancedMetrics?.holderIntelligence?.riskLevel || 'LOW';
    const bundlePercent = token.advancedMetrics?.snipeVolumePercent || 0;

    return (
        <VortexPanel title="Activity signals" subTitle="Heuristic analysis" glowColor="cyan">
            <div className="vortex-flex-column vortex-gap-4">
                <div className="vortex-flex-between">
                    <span className="vortex-label">Bundle Density</span>
                    <span className={`badge-vortex ${bundleRisk === 'HIGH' ? 'badge-whale' : 'badge-verified'}`}>
                        {bundleRisk} SIGNAL
                    </span>
                </div>

                <div className="vortex-metric-card vortex-p-0">
                    <div className="vortex-flex-between vortex-mb-1">
                        <span className="vortex-text-tiny vortex-text-muted">SAMPLED ACTIVITY</span>
                        <span className={`vortex-text-tiny vortex-text-bold ${bundleRisk === 'HIGH' ? 'text-vortex-red' : 'text-vortex-yellow'}`}>
                            {bundlePercent}%
                        </span>
                    </div>
                    <div className="vortex-progress-bg vortex-progress-sm">
                        <div
                            className={`vortex-progress-fill ${bundleRisk === 'HIGH' ? 'vortex-bg-red' : 'vortex-bg-purple'}`}
                            style={{ width: `${Math.max(0, Math.min(100, bundlePercent))}%` }}
                        ></div>
                    </div>
                </div>

                <div className="vortex-input-container">
                    <div className="vortex-flex-start vortex-gap-2 vortex-mb-1">
                        <Zap size={12} className="text-vortex-cyan" />
                        <span className="vortex-text-tiny vortex-text-bold">DATA CONTEXT</span>
                    </div>
                    <p className="vortex-text-xs vortex-text-muted vortex-m-0">
                        {bundleRisk === 'HIGH'
                            ? 'Elevated clustering signal in sampled activity. Review the underlying transactions.'
                            : 'No elevated signal in the available sample. Missing data can also produce a low reading; this is not a safety rating.'}
                    </p>
                </div>

                <div className="vortex-flex-column vortex-gap-2 vortex-mt-4">
                    <VortexButton
                        variant="primary"
                        className="vortex-full-width vortex-bg-cyan text-vortex-obsidian vortex-text-bold vortex-ls-wide"
                        onClick={() => setShowDeepScan(true)}
                    >
                        Open deep scan · 0.05 SOL
                    </VortexButton>

                    {token.tier !== 'Elite' && (
                        <VortexButton
                            variant="ghost"
                            className="vortex-full-width vortex-text-tiny text-vortex-muted hover:text-vortex-cyan"
                            onClick={onEnhance}
                        >
                            Explore profile upgrades
                        </VortexButton>
                    )}
                </div>
            </div>

            <DeepScanModal
                isOpen={showDeepScan}
                onClose={() => setShowDeepScan(false)}
                tokenSymbol={token.symbol}
                tokenAddress={token.address}
            />
        </VortexPanel>
    );
}
