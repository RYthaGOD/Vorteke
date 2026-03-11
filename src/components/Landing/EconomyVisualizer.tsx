'use client';

import React from 'react';
import { Flame, ShieldCheck, Zap } from 'lucide-react';

export function EconomyVisualizer() {
    return (
        <div className="economy-container">
            <div className="vortex-grid-3 vortex-gap-6">
                <div className="eco-card eco-vtx-burn">
                    <div className="eco-header">
                        <Zap className="text-vortex-cyan" size={18} />
                        <span className="vortex-text-tiny vortex-text-bold">REAL-TIME_RECON</span>
                    </div>
                    <div className="eco-value text-vortex-cyan">OPTIMIZED</div>
                    <p className="vortex-text-xs vortex-text-muted">
                        Direct integration with Helius and custom RPC endpoints for ultra-low latency token discovery.
                    </p>
                    <div className="burn-meter">
                        <div className="meter-fill" style={{ width: '95%' }}></div>
                        <div className="meter-pulse"></div>
                    </div>
                </div>

                <div className="eco-card eco-vanguard">
                    <div className="eco-header">
                        <ShieldCheck className="text-vortex-yellow" size={18} />
                        <span className="vortex-text-tiny vortex-text-bold">FORENSIC_SCRUTINY</span>
                    </div>
                    <div className="eco-value text-vortex-yellow">MATHEMATICAL</div>
                    <p className="vortex-text-xs vortex-text-muted">
                        Automated liquidity audits and holder-concentration analysis using on-chain account verification.
                    </p>
                    <div className="discount-meter">
                        <div className="meter-bar"></div>
                        <div className="meter-label">SCAN_PROTOCOL_ACTIVE</div>
                    </div>
                </div>

                <div className="eco-card eco-elite">
                    <div className="eco-header">
                        <Zap className="text-vortex-gold" size={18} />
                        <span className="vortex-text-tiny vortex-text-bold">ELITE_LIQUIDITY</span>
                    </div>
                    <div className="eco-value text-vortex-gold">VORTEX_PRIME</div>
                    <p className="vortex-text-sm vortex-text-muted">
                        Elite users bypass the standard protocol fee on all swaps and gain access to the **Priority Node Uplink** (5s refreshes) for maximum forensic precision.
                    </p>
                    <div className="vortex-corners">
                        <div className="vortex-corner-tl" />
                        <div className="vortex-corner-child" />
                        <div className="vortex-corner-br" />
                    </div>
                </div>
            </div>

            <div className="vtx-flow-visual vortex-mt-12">
                <div className="flow-step">
                    <div className="step-box glass-panel">USERS</div>
                </div>
                <div className="flow-arrow cyan-pulse">
                    <svg width="40" height="20" viewBox="0 0 40 20">
                        <path d="M0 10 H30 L25 5 M30 10 L25 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="vortex-text-tiny text-vortex-cyan">ENHANCE_TX</span>
                </div>
                <div className="flow-step">
                    <div className="step-box glass-panel text-vortex-yellow">RECON_TERMINAL</div>
                </div>
                <div className="flow-arrow cyan-pulse">
                    <svg width="40" height="20" viewBox="0 0 40 20">
                        <path className="path-draw" d="M0 10 H30 L25 5 M30 10 L25 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="vortex-text-tiny text-vortex-yellow">DATA_UPLINK</span>
                </div>
                <div className="flow-step">
                    <div className="step-box glass-panel h-cyan">STRATEGIC_INTEL</div>
                </div>
            </div>

            <style jsx>{`
                .economy-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 40px 100px;
                }

                .eco-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 32px;
                    border-radius: 2px;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }

                .eco-card:hover {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(255, 255, 255, 0.1);
                    transform: translateY(-2px);
                }

                .eco-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 24px;
                }

                .eco-value {
                    font-size: 28px;
                    font-weight: 900;
                    letter-spacing: 1px;
                    margin-bottom: 12px;
                    font-family: var(--font-hud);
                }

                .burn-meter {
                    height: 4px;
                    background: rgba(255, 255, 255, 0.05);
                    margin-top: 24px;
                    position: relative;
                    overflow: hidden;
                }

                .meter-fill {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 0;
                    width: 75%;
                    background: var(--accent-vortex-yellow);
                }

                .meter-pulse {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    background: linear-gradient(90deg, transparent, rgba(229, 255, 0, 0.4), transparent);
                    animation: meter-pulse 2s linear infinite;
                }

                .discount-meter {
                    margin-top: 24px;
                    padding: 8px;
                    background: rgba(0, 240, 255, 0.05);
                    border: 1px dashed rgba(0, 240, 255, 0.2);
                    font-size: 10px;
                    font-weight: 800;
                    text-align: center;
                    color: var(--accent-vortex-cyan);
                    letter-spacing: 1px;
                }

                .vtx-flow-visual {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    padding: 40px;
                    background: rgba(255, 255, 255, 0.01);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }

                .step-box {
                    padding: 12px 24px;
                    font-family: var(--font-hud);
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 2px;
                }

                .flow-arrow {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .path-draw {
                    stroke-dasharray: 100;
                    animation: path-draw 3s linear infinite;
                }

                @keyframes meter-pulse {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }

                @keyframes path-draw {
                    from { stroke-dashoffset: 100; }
                    to { stroke-dashoffset: -100; }
                }

                .h-red { color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }

                @media (max-width: 1024px) {
                    .vortex-grid-3 { grid-template-columns: 1fr; }
                    .vtx-flow-visual { flex-direction: column; gap: 40px; }
                    .flow-arrow { transform: rotate(90deg); }
                }
            `}</style>

        </div>
    );
}
