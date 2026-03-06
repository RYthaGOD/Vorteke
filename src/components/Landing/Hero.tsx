'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ShieldCheck, Zap, Activity } from 'lucide-react';
import { VortexLogo } from '@/components/DesignSystem';

export function Hero() {
    const router = useRouter();

    return (
        <section className="hero-vanguard">
            <div className="hero-background">
                <div className="grid-overlay"></div>
                <div className="radial-glow"></div>
                <div className="scanline"></div>
            </div>

            <div className="hero-content">
                <div className="vortex-mb-8">
                    <VortexLogo size="hero" showLabel={true} />
                </div>

                <div className="vanguard-badge">

                    <ShieldCheck size={14} className="text-vortex-yellow" />
                    <span>PROTOCOL_VTX_V9_ACTIVE</span>
                </div>

                <h1 className="hero-title glitch-text" data-text="MASTER_THE_SINGULARITY">
                    MASTER THE<br />
                    <span className="hero-gradient">SINGULARITY</span>
                </h1>

                <p className="hero-description">
                    The ultimate industrial-grade reconnaissance interface for the Solana network.
                    Real-time telemetry, automated safety scrutiny, and elite portfolio intelligence.
                </p>

                <div className="hero-actions">
                    <button
                        className="btn-vortex btn-vortex-primary btn-hero-main"
                        onClick={() => router.push('/terminal')}
                    >
                        LAUNCH_TERMINAL <ChevronRight size={20} />
                    </button>
                    <button className="btn-vortex btn-vortex-secondary btn-hero-alt">
                        VIEW_RECON_DOCS
                    </button>
                </div>

                <div className="hero-stats">
                    <div className="stat-item">
                        <span className="stat-value text-vortex-cyan">0.2s</span>
                        <span className="stat-label">DISCOVERY_LATENCY</span>
                    </div>
                    <div className="divider"></div>
                    <div className="stat-item">
                        <span className="stat-value text-vortex-yellow">100%</span>
                        <span className="stat-label">BURN_PROTOCOL</span>
                    </div>
                    <div className="divider"></div>
                    <div className="stat-item">
                        <span className="stat-value text-vortex-gold">50%</span>
                        <span className="stat-label">$VTX_YIELD_LOCK</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .hero-vanguard {
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    padding-top: 80px;
                    overflow: hidden;
                    background: radial-gradient(circle at center, #0a0a0c 0%, #050506 100%);
                }

                .hero-background {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                }

                .grid-overlay {
                    position: absolute;
                    inset: 0;
                    background-image: 
                        linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px);
                    background-size: 60px 60px;
                    background-position: center center;
                    perspective: 1000px;
                    transform: rotateX(60deg) translateY(-200px) translateZ(0);
                    opacity: 0.4;
                    animation: grid-drift 20s linear infinite;
                }

                @keyframes grid-drift {
                    from { background-position: center 0; }
                    to { background-position: center 60px; }
                }

                .radial-glow {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, rgba(0, 240, 255, 0.08) 0%, transparent 70%);
                }

                .scanline {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(to bottom, transparent 0%, rgba(0, 240, 255, 0.03) 50%, transparent 100%);
                    background-size: 100% 4px;
                    animation: scan 10s linear infinite;
                    opacity: 0.2;
                }

                .hero-content {
                    position: relative;
                    z-index: 2;
                    text-align: center;
                    max-width: 900px;
                    padding: 0 20px;
                }

                .vanguard-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(229, 255, 0, 0.05);
                    border: 1px solid rgba(229, 255, 0, 0.2);
                    padding: 8px 16px;
                    border-radius: 2px;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 2px;
                    color: var(--accent-vortex-yellow);
                    margin-bottom: 40px;
                    font-family: var(--font-hud);
                    text-transform: uppercase;
                }

                .hero-title {
                    font-size: 82px;
                    font-weight: 950;
                    line-height: 0.95;
                    letter-spacing: -2px;
                    margin-bottom: 24px;
                    font-family: var(--font-hud);
                }

                .hero-gradient {
                    background: linear-gradient(90deg, var(--accent-vortex-cyan), var(--accent-vortex-yellow), var(--accent-vortex-cyan));
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: gradient 10s linear infinite;
                }

                .hero-description {
                    font-size: 18px;
                    color: rgba(255, 255, 255, 0.5);
                    line-height: 1.6;
                    margin-bottom: 48px;
                    max-width: 650px;
                    margin-left: auto;
                    margin-right: auto;
                    font-weight: 400;
                    letter-spacing: 0.01em;
                }

                .hero-actions {
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                    margin-bottom: 80px;
                }

                .btn-hero-main {
                    height: 60px;
                    padding: 0 40px;
                    font-size: 16px;
                    letter-spacing: 2px;
                    background: var(--accent-vortex-yellow);
                    color: #000;
                    border: none;
                    font-weight: 800;
                }

                .btn-hero-alt {
                    height: 60px;
                    padding: 0 40px;
                    font-size: 16px;
                    letter-spacing: 2px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #fff;
                }

                .btn-hero-alt:hover {
                    border-color: var(--accent-vortex-cyan);
                    color: var(--accent-vortex-cyan);
                    background: rgba(0, 240, 255, 0.05);
                }

                .hero-stats {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 60px;
                    padding-top: 40px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }

                .stat-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .stat-value {
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    font-family: var(--font-hud);
                }

                .stat-label {
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 2px;
                    color: rgba(255, 255, 255, 0.3);
                    text-transform: uppercase;
                }

                .divider {
                    width: 1px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.05);
                }

                @keyframes scan {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(100%); }
                }

                @keyframes gradient {
                    to { background-position: 200% center; }
                }

                @media (max-width: 768px) {
                    .hero-vanguard { padding-top: 60px; }
                    .hero-content { padding: 0 24px; }
                    .hero-title { 
                        font-size: clamp(32px, 10vw, 48px); 
                        letter-spacing: -1px;
                        margin-bottom: 16px;
                    }
                    .hero-description { font-size: 14px; margin-bottom: 32px; }
                    .hero-stats { gap: 16px; flex-wrap: wrap; margin-top: 40px; }
                    .hero-actions { flex-direction: column; gap: 12px; width: 100%; }
                    .btn-hero-main, .btn-hero-alt { width: 100%; height: 50px; font-size: 14px; }
                    .stat-item { text-align: center; width: calc(50% - 8px); }
                    .divider { display: none; }
                }

            `}</style>

        </section>
    );
}
