'use client';

import React from 'react';
import { Flame, Percent, ArrowDownCircle, ShieldCheck } from 'lucide-react';

export function EconomyVisualizer() {
    return (
        <div className="economy-container">
            <div className="economy-grid">
                <div className="economy-card burn-card">
                    <div className="card-header">
                        <Flame className="text-vortex-red animate-pulse" />
                        <h3>THE_FORGE</h3>
                    </div>
                    <div className="burn-value">100% BURN</div>
                    <p>Every $VTX token used for profile enhancements is physically burned from the total supply. Permanent deflation, verified on-chain.</p>
                </div>

                <div className="economy-card discount-card border-vortex-cyan">
                    <div className="card-header">
                        <Percent className="text-vortex-cyan" />
                        <h3>VANGUARD_DISCOUNT</h3>
                    </div>
                    <div className="discount-value">50% OFF</div>
                    <p>Pay with $VTX to unlock Elite and Enhanced profile tiers at precisely half the cost of SOL or USDC payments.</p>
                </div>

                <div className="economy-card yield-card">
                    <div className="card-header">
                        <ArrowDownCircle className="text-vortex-yellow" />
                        <h3>ELITE_LIQUIDITY</h3>
                    </div>
                    <div className="yield-value">ZERO FEES</div>
                    <p>VORTEX Elite NFT holders bypass all protocol flat fees on every swap, ensuring maximum yield on every tactical play.</p>
                </div>
            </div>

            <div className="vtx-flow-visual">
                <div className="flow-step">
                    <div className="step-box">ENHANCEMENT_PURCHASE</div>
                    <div className="arrow">âžž</div>
                </div>
                <div className="flow-step">
                    <div className="step-box highlight-cyan">50%_DISCOUNT_APPLIED</div>
                    <div className="arrow">âžž</div>
                </div>
                <div className="flow-step">
                    <div className="step-box highlight-red">100%_VTX_BURNED</div>
                    <div className="status">âœ“ VERIFIED</div>
                </div>
            </div>

            <style jsx>{`
                .economy-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 40px 100px;
                }

                .economy-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 30px;
                    margin-bottom: 80px;
                }

                .economy-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 40px;
                    border-radius: 4px;
                    transition: all 0.3s ease;
                }

                .economy-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.2);
                    transform: translateY(-5px);
                }

                .border-vortex-cyan {
                    border-color: rgba(0, 255, 234, 0.3);
                    box-shadow: 0 0 30px rgba(0, 255, 234, 0.05);
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 24px;
                }

                .card-header h3 {
                    font-size: 14px;
                    font-weight: 800;
                    letter-spacing: 2px;
                    margin: 0;
                }

                .burn-value, .discount-value, .yield-value {
                    font-size: 42px;
                    font-weight: 900;
                    margin-bottom: 20px;
                    letter-spacing: -1px;
                }

                .burn-value { color: #ff007a; }
                .discount-value { color: #00ffea; }
                .yield-value { color: #ffc400; }

                .economy-card p {
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 0;
                }

                .vtx-flow-visual {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 20px;
                    padding: 40px;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px dashed rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                }

                .flow-step {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .step-box {
                    padding: 12px 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 1px;
                }

                .highlight-cyan {
                    border-color: #00ffea;
                    color: #00ffea;
                    box-shadow: 0 0 15px rgba(0, 255, 234, 0.2);
                }

                .highlight-red {
                    border-color: #ff007a;
                    color: #ff007a;
                    box-shadow: 0 0 15px rgba(255, 0, 122, 0.2);
                }

                .arrow {
                    color: rgba(255, 255, 255, 0.2);
                    font-size: 20px;
                }

                .status {
                    font-size: 10px;
                    font-weight: 800;
                    color: #00ffea;
                    letter-spacing: 1px;
                }

                @media (max-width: 1024px) {
                    .economy-grid { grid-template-columns: 1fr; }
                    .vtx-flow-visual { flex-direction: column; }
                    .arrow { transform: rotate(90deg); }
                }
            `}</style>
        </div>
    );
}
