'use client';

import React from 'react';
import { Search, Activity, ShieldCheck, Zap, BarChart3, Lock } from 'lucide-react';
import { VortexPanel } from '../DesignSystem';

const features = [
    {
        title: 'RECON_ENGINE',
        description: 'Advanced real-time market reconnaissance with 200ms discovery latency.',
        icon: <Search className="text-vortex-cyan" />,
        color: 'cyan'
    },
    {
        title: 'VERIFIED_VAULT',
        description: 'Automated safety scrutinizers ensuring LP burn and mint renunciation.',
        icon: <ShieldCheck className="text-vortex-yellow" />,
        color: 'yellow'
    },
    {
        title: 'PORTFOLIO_INTEL',
        description: 'Deep-mesh tracking for Token-2022 assets with instant PnL resolution.',
        icon: <Activity className="text-vortex-cyan" />,
        color: 'cyan'
    },
    {
        title: 'EXECUTION_ELITE',
        description: 'Jito-Turbo protocol integration for mev-free, blink-of-an-eye swaps.',
        icon: <Zap className="text-vortex-yellow" />,
        color: 'yellow'
    },
    {
        title: 'DEEP_SCAN_SUITE',
        description: 'Contract level source audit and holder concentration analysis.',
        icon: <BarChart3 className="text-vortex-cyan" />,
        color: 'cyan'
    },
    {
        title: 'ELITE_ACCESS',
        description: 'Exclusive verification tiers and zero-fee swaps for NFT pass holders.',
        icon: <Lock className="text-vortex-yellow" />,
        color: 'yellow'
    }
];

export function FeatureCards() {
    return (
        <div className="features-grid">
            {features.map((f, i) => (
                <div key={i} className="feature-item">
                    <VortexPanel
                        title={f.title}
                        subTitle="SYSTEM_MODULE"
                        glowColor={f.color as any}
                    >
                        <div className="feature-content">
                            <div className="feature-icon">
                                {f.icon}
                            </div>
                            <p>{f.description}</p>
                        </div>
                    </VortexPanel>
                </div>
            ))}

            <style jsx>{`
                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 30px;
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 40px 100px;
                }

                .feature-content {
                    padding: 20px 0;
                }

                .feature-icon {
                    margin-bottom: 20px;
                    transform: scale(1.5);
                    transform-origin: left;
                }

                .feature-content p {
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 15px;
                    line-height: 1.6;
                    margin: 0;
                }

                @media (max-width: 1024px) {
                    .features-grid { grid-template-columns: repeat(2, 1fr); }
                }

                @media (max-width: 768px) {
                    .features-grid { grid-template-columns: 1fr; padding: 0 20px 60px; }
                }
            `}</style>
        </div>
    );
}
