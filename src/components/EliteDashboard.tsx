'use client';
import React, { useEffect, useState } from 'react';
import { Shield, Target, Activity, Loader2 } from 'lucide-react';
import { TokenInfo, getRecentlyViewed, subscribeToLiveStream, VortexTx } from '@/lib/dataService';
import { VortexPanel } from '@/components/DesignSystem';

export default function EliteDashboard() {
    const [recentTokens, setRecentTokens] = useState<TokenInfo[]>([]);
    const [pulse, setPulse] = useState<VortexTx[]>([]);
    const [loading, setLoading] = useState(true);

    const cleanupRef = React.useRef<(() => void) | null>(null);

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
                // H5 FIX: Store cleanup in a ref so unmount can call it synchronously
                // regardless of whether the async chain has resolved.
                const stopSubs = tokens.slice(0, 3).map(token =>
                    subscribeToLiveStream(token.address, (tx) => {
                        setPulse(prev => [tx, ...prev].slice(0, 10));
                    })
                );
                cleanupRef.current = () => stopSubs.forEach(unsub => unsub());
            }
        };

        initDashboard();

        return () => {
            isMounted = false;
            if (cleanupRef.current) cleanupRef.current();
        };
    }, []);

    const targetToken = recentTokens[0];

    if (loading) {
        return (
            <VortexPanel title="ELITE_INTEL" subTitle="SYNCHRONIZING">
                <div className="vortex-flex-column vortex-center vortex-py-20">
                    <Loader2 className="vortex-animate-spin text-vortex-yellow vortex-mb-4" size={32} />
                    <span className="vortex-text-tiny vortex-text-muted">SYNCING_VORTEX_DAEMON...</span>
                </div>
            </VortexPanel>
        );
    }

    return (
        <VortexPanel title="ELITE_INTELLIGENCE" subTitle="HIGH_FIDELITY_RECON" glowColor="cyan" showCorners={true}>
            <div className="vortex-flex-between vortex-mb-6">
                <p className="vortex-text-xs vortex-text-muted vortex-m-0">Global instructions & verified whale telemetry streams.</p>
                <div className="badge-vortex badge-verified">ACCESS_ACTIVE</div>
            </div>

            <div className="row vortex-gap-4">
                {/* Neural Pulse Feed */}
                <div className="vortex-col-4">
                    <VortexPanel variant="glass" glowColor="cyan" className="vortex-h-full">
                        <div className="vortex-flex-start vortex-gap-2 vortex-mb-3">
                            <Activity size={14} className="text-vortex-cyan" />
                            <h3 className="vortex-text-tiny vortex-text-bold vortex-uppercase vortex-m-0">PULSE_STREAM_2.0</h3>
                        </div>
                        <div className="vortex-terminal-small">
                            {pulse.length === 0 ? (
                                <div className="terminal-line"><span className="text-vortex-cyan">[PULSE]</span> AWAITING_ON_CHAIN_DYNAMICS...</div>
                            ) : (
                                pulse.map((tx) => (
                                    <div key={tx.signature} className="terminal-line animate-fade-in">
                                        <span className={tx.type === 'BUY' ? 'text-vortex-yellow' : 'text-vortex-red'}>[{tx.type}]</span> {tx.amountSol.toFixed(2)} SOL :: {tx.wallet.slice(0, 4)}...
                                    </div>
                                ))
                            )}
                            <div className="terminal-line vortex-animate-pulse">_</div>
                        </div>
                    </VortexPanel>
                </div>

                {/* Targeted Recon */}
                <div className="vortex-col-4">
                    <VortexPanel variant="glass" glowColor="cyan" className="vortex-h-full">
                        <div className="vortex-flex-start vortex-gap-2 vortex-mb-3">
                            <Target size={14} className="text-vortex-cyan" />
                            <h3 className="vortex-text-tiny vortex-text-bold vortex-uppercase vortex-m-0">TARGET_METRICS</h3>
                        </div>
                        {targetToken ? (
                            <div className="vortex-flex-column vortex-gap-2">
                                <div className="metric-row">
                                    <span className="vortex-text-tiny vortex-text-muted">Concentration</span>
                                    <span className={`vortex-text-xs vortex-text-bold ${targetToken.advancedMetrics?.holderIntelligence?.riskLevel === 'HIGH' ? 'text-vortex-red' : 'text-vortex-yellow'}`}>
                                        {targetToken.advancedMetrics?.holderIntelligence?.top10Percent || 0}%
                                    </span>
                                </div>
                                <div className="metric-row">
                                    <span className="vortex-text-tiny vortex-text-muted">Market_Velocity</span>
                                    <span className="vortex-text-xs vortex-text-bold text-vortex-cyan">{targetToken.advancedMetrics?.marketVelocity?.activityLevel || 'STABLE'}</span>
                                </div>
                                <div className="metric-row">
                                    <span className="vortex-text-tiny vortex-text-muted">LP_Forensics</span>
                                    <span className={`vortex-text-xs vortex-text-bold ${targetToken.advancedMetrics?.lpBurnStatus === 'verified' ? 'text-vortex-cyan' : 'text-vortex-red'}`}>
                                        {targetToken.advancedMetrics?.lpBurnStatus?.toUpperCase() || 'UNVERIFIED'}
                                    </span>
                                </div>
                                <div className="metric-row">
                                    <span className="vortex-text-tiny vortex-text-muted">Source_Integrity</span>
                                    <span className="vortex-text-xs vortex-text-bold text-vortex-yellow">
                                        {targetToken.advancedMetrics?.fundingSource?.type || 'UNKNOWN'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="vortex-text-center vortex-py-8 vortex-opacity-30 vortex-text-tiny">NO_TARGET_SELECTED</div>
                        )}
                    </VortexPanel>
                </div>

                {/* Risk Profiler */}
                <div className="vortex-col-4">
                    <VortexPanel variant="glass" glowColor="yellow" className="vortex-h-full">
                        <div className="vortex-flex-start vortex-gap-2 vortex-mb-3">
                            <Shield size={14} className="text-vortex-yellow" />
                            <h3 className="vortex-text-tiny vortex-text-bold vortex-uppercase vortex-m-0">THREAT_LEVEL</h3>
                        </div>
                        <div className="vortex-flex-column vortex-center vortex-py-4">
                            <div className={`vortex-text-2xl vortex-text-extrabold hud-flicker ${targetToken?.advancedMetrics?.holderIntelligence?.riskLevel === 'HIGH' ||
                                (targetToken?.advancedMetrics?.cluster?.length || 0) > 3
                                ? 'text-vortex-red' : 'text-vortex-yellow'
                                }`}>
                                {(targetToken?.advancedMetrics?.cluster?.length || 0) > 3 ? 'EXTREME' : (targetToken?.advancedMetrics?.holderIntelligence?.riskLevel || 'CLEAN')}
                            </div>
                            <div className="vortex-text-tiny vortex-text-muted vortex-mt-2 vortex-font-mono">
                                {targetToken?.advancedMetrics?.snipeVolumePercent || 0}% BUNDLE_DENSITY
                            </div>
                        </div>
                    </VortexPanel>
                </div>
            </div>

            <style jsx>{`
                .metric-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 2px;
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }

                .row { 
                    display: flex; 
                    width: 100%; 
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                
                .vortex-col-4 { 
                    width: calc(33.33% - 0.7rem); 
                    min-width: 250px;
                }

                @media (max-width: 1024px) {
                    .vortex-col-4 { width: calc(50% - 0.5rem); }
                }

                @media (max-width: 640px) {
                    .vortex-col-4 { width: 100%; }
                }
            `}</style>
        </VortexPanel>
    );
}

