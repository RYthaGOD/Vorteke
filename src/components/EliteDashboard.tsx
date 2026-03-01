'use client';
import React, { useEffect, useState } from 'react';
import { Shield, Target, Activity, Loader2 } from 'lucide-react';
import { TokenInfo, getRecentlyViewed, subscribeToLiveStream, VortexTx } from '@/lib/dataService';
import { VortexPanel } from '@/components/DesignSystem';

export default function EliteDashboard() {
    const [recentTokens, setRecentTokens] = useState<TokenInfo[]>([]);
    const [pulse, setPulse] = useState<VortexTx[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const initDashboard = async () => {
            let tokens = getRecentlyViewed();

            // Fallback: If cache is empty, fetch trending tokens to populate dashboard
            if (tokens.length === 0) {
                try {
                    const res = await fetch('/api/discovery?type=trending');
                    if (res.ok) {
                        const data = await res.json();
                        tokens = data.slice(0, 3);
                    }
                } catch (e) {
                    console.error("ELITE_FALLBACK_FAIL", e);
                }
            }

            if (!isMounted) return;
            setRecentTokens(tokens);
            setLoading(false);

            if (tokens.length > 0) {
                const stopSubs = tokens.slice(0, 3).map(token =>
                    subscribeToLiveStream(token.address, (tx) => {
                        setPulse(prev => [tx, ...prev].slice(0, 10));
                    })
                );

                return () => stopSubs.forEach(unsub => unsub());
            }
        };

        const cleanupPromise = initDashboard();

        return () => {
            isMounted = false;
            cleanupPromise.then(cleanupFn => {
                if (typeof cleanupFn === 'function') cleanupFn();
            });
        };
    }, []);

    const targetToken = recentTokens[0];

    if (loading) {
        return (
            <VortexPanel title="ELITE_INTEL" subTitle="SYNCHRONIZING">
                <div className="vortex-flex-column vortex-center vortex-py-20">
                    <Loader2 className="vortex-animate-spin text-vortex-yellow vortex-mb-4" size={32} />
                    <span className="vortex-text-tiny vortex-text-muted">DECODING_NEURAL_STREAMS...</span>
                </div>
            </VortexPanel>
        );
    }

    return (
        <VortexPanel title="ELITE_INTELLIGENCE" subTitle="HIGH_FIDELITY_RECON" glowColor="cyan">
            <div className="vortex-flex-between vortex-mb-6">
                <p className="vortex-text-xs vortex-text-muted vortex-m-0">Whale telemetry & advanced instruction decoding.</p>
                <div className="badge-vortex badge-verified">ELITE_ACCESS_ACTIVE</div>
            </div>

            <div className="vortex-grid-3 vortex-gap-4">
                {/* Neural Pulse Feed */}
                <div className="vortex-bg-obsidian-soft vortex-p-4 vortex-border-radius-lg vortex-border vortex-border-vortex-muted">
                    <div className="vortex-flex-start vortex-gap-2 vortex-mb-3">
                        <Activity size={16} className="text-vortex-cyan" />
                        <h3 className="vortex-text-xs vortex-text-bold vortex-uppercase vortex-m-0">NEURAL_PULSE_2.0</h3>
                    </div>
                    <div className="vortex-terminal-small">
                        {pulse.length === 0 ? (
                            <div className="terminal-line"><span className="text-vortex-cyan">[PULSE]</span> AWAITING_ON_CHAIN_DYNAMICS...</div>
                        ) : (
                            pulse.map((tx, i) => (
                                <div key={i} className="terminal-line animate-fade-in">
                                    <span className={tx.type === 'BUY' ? 'text-vortex-yellow' : 'text-vortex-red'}>[{tx.type}]</span> {tx.amountSol.toFixed(2)} SOL :: {tx.wallet.slice(0, 4)}...{tx.wallet.slice(-4)}
                                </div>
                            ))
                        )}
                        <div className="terminal-line vortex-animate-pulse">_</div>
                    </div>
                </div>

                {/* Targeted Recon */}
                <div className="vortex-bg-obsidian-soft vortex-p-4 vortex-border-radius-lg vortex-border vortex-border-vortex-muted">
                    <div className="vortex-flex-start vortex-gap-2 vortex-mb-3">
                        <Target size={16} className="text-vortex-cyan" />
                        <h3 className="vortex-text-xs vortex-text-bold vortex-uppercase vortex-m-0">TARGET_RECON</h3>
                    </div>
                    {targetToken ? (
                        <div className="vortex-flex-column vortex-gap-2">
                            <div className="vortex-flex-between vortex-p-2 vortex-bg-obsidian vortex-border-radius-md">
                                <span className="vortex-text-tiny vortex-text-muted">Concentration</span>
                                <span className={`vortex-text-xs vortex-text-bold ${targetToken.advancedMetrics?.holderIntelligence?.riskLevel === 'HIGH' ? 'text-vortex-red' : 'text-vortex-yellow'}`}>
                                    {targetToken.advancedMetrics?.holderIntelligence?.top10Percent || 0}%
                                </span>
                            </div>
                            <div className="vortex-flex-between vortex-p-2 vortex-bg-obsidian vortex-border-radius-md">
                                <span className="vortex-text-tiny vortex-text-muted">Velocity</span>
                                <span className="vortex-text-xs vortex-text-bold text-vortex-cyan">{targetToken.advancedMetrics?.volumeVelocity?.status || 'STABLE'}</span>
                            </div>
                            <div className="vortex-flex-between vortex-p-2 vortex-bg-obsidian vortex-border-radius-md">
                                <span className="vortex-text-tiny vortex-text-muted">LP_Trust</span>
                                <span className="vortex-text-xs vortex-text-bold text-vortex-yellow">SECURE</span>
                            </div>
                        </div>
                    ) : (
                        <div className="vortex-text-center vortex-py-8 vortex-opacity-30 vortex-text-tiny vortex-font-mono">AWAITING_SELECTION</div>
                    )}
                </div>

                {/* Continuum Metrics */}
                <div className="vortex-bg-obsidian-soft vortex-p-4 vortex-border-radius-lg vortex-border vortex-border-vortex-muted">
                    <div className="vortex-flex-start vortex-gap-2 vortex-mb-3">
                        <Shield size={16} className="text-vortex-yellow" />
                        <h3 className="vortex-text-xs vortex-text-bold vortex-uppercase vortex-m-0">CONTINUUM_RISK</h3>
                    </div>
                    <div className="vortex-flex-column vortex-center vortex-py-4">
                        <div className={`vortex-text-2xl vortex-text-extrabold ${targetToken?.advancedMetrics?.holderIntelligence?.riskLevel === 'HIGH' ? 'text-vortex-red' : 'text-vortex-yellow'}`}>
                            {targetToken?.advancedMetrics?.holderIntelligence?.riskLevel || 'CLEAN'}
                        </div>
                        <div className="vortex-text-tiny vortex-text-muted vortex-mt-2 vortex-font-mono">
                            {targetToken?.advancedMetrics?.snipeVolumePercent || 0}% BUNDLE_DENSITY
                        </div>
                    </div>
                </div>
            </div>
        </VortexPanel>
    );
}
