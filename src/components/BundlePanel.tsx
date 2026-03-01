'use client';
import React, { useState } from 'react';
import { Layers, Zap, Info, ShieldAlert } from 'lucide-react';
import { TokenInfo, formatPercent } from '@/lib/dataService';

interface BundlePanelProps {
    token: TokenInfo;
    onEnhance: () => void;
}

import { VortexPanel, VortexButton } from '@/components/DesignSystem';
import { DeepScanModal } from './DeepScanModal';

export function BundlePanel({ token, onEnhance }: BundlePanelProps) {
    const [showDeepScan, setShowDeepScan] = useState(false);
    const bundleRisk = token.advancedMetrics?.holderIntelligence?.riskLevel || 'LOW';
    const bundlePercent = token.advancedMetrics?.holderIntelligence?.clusterSize || 0;

    return (
        <VortexPanel title="CONTINUUM_RECON" subTitle="HOLDER_ANALYSIS" glowColor="cyan">
            <div className="vortex-flex-column vortex-gap-4">
                <div className="vortex-flex-between">
                    <span className="vortex-label">Bundle Density</span>
                    <span className={`badge-vortex ${bundleRisk === 'HIGH' ? 'badge-whale' : 'badge-verified'}`}>
                        {bundleRisk}_RISK
                    </span>
                </div>

                <div className="vortex-metric-card vortex-p-0">
                    <div className="vortex-flex-between vortex-mb-1">
                        <span className="vortex-text-tiny vortex-text-muted">CLUSTER_EXPOSURE</span>
                        <span className={`vortex-text-tiny vortex-text-bold ${bundleRisk === 'HIGH' ? 'text-vortex-red' : 'text-vortex-yellow'}`}>
                            {bundlePercent}% Supply
                        </span>
                    </div>
                    <div className="vortex-progress-bg vortex-progress-sm">
                        <div
                            className={`vortex-progress-fill ${bundleRisk === 'HIGH' ? 'vortex-bg-red' : 'vortex-bg-purple'}`}
                            style={{ width: `${bundlePercent}%` }}
                        ></div>
                    </div>
                </div>

                <div className="vortex-input-container">
                    <div className="vortex-flex-start vortex-gap-2 vortex-mb-1">
                        <Zap size={12} className="text-vortex-cyan" />
                        <span className="vortex-text-tiny vortex-text-bold">VORTEX_INSIGHT</span>
                    </div>
                    <p className="vortex-text-xs vortex-text-muted vortex-m-0">
                        {bundleRisk === 'HIGH'
                            ? 'Critical cluster detected. High coordination risk.'
                            : 'Organic distribution. No significant clusters detected.'}
                    </p>
                </div>

                <div className="vortex-flex-column vortex-gap-2 vortex-mt-4">
                    <VortexButton
                        variant="primary"
                        className="vortex-full-width vortex-bg-cyan text-vortex-obsidian vortex-text-bold vortex-ls-wide"
                        onClick={() => setShowDeepScan(true)}
                    >
                        INITIATE DEEP SCAN (0.02 SOL)
                    </VortexButton>

                    {token.tier !== 'Elite' && (
                        <VortexButton
                            variant="ghost"
                            className="vortex-full-width vortex-text-tiny text-vortex-muted hover:text-vortex-cyan"
                            onClick={onEnhance}
                        >
                            UPGRADE TO ELITE RECON SUITE
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
