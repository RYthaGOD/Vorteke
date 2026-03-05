'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hero } from '@/components/Landing/Hero';
import { FeatureCards } from '@/components/Landing/FeatureCards';
import { EconomyVisualizer } from '@/components/Landing/EconomyVisualizer';
import { Footer } from '@/components/Landing/Footer';
import { ShieldCheck, Zap, Activity, BarChart3, Lock, Rocket, ChevronRight, Github, Twitter } from 'lucide-react';

export default function LandingPage() {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="vortex-landing-shell">
            {/* VORTEX NAV - VANGUARD EDITION */}
            <nav className={`landing-nav ${scrolled ? 'nav-scrolled' : ''}`}>
                <div className="nav-content">
                    <div className="brand">
                        <div className="logo-icon"></div>
                        <span className="logo-text glitch-text">VORTEX</span>
                    </div>

                    <div className="nav-links">
                        <a href="#features" className="nav-link">SYSTEMS</a>
                        <a href="#economy" className="nav-link">ECONOMY</a>
                        <a href="https://github.com/RYthaGOD/Vorteke" target="_blank" className="nav-link">DOCS</a>
                    </div>

                    <button
                        className="btn-vortex btn-vortex-primary btn-glow"
                        onClick={() => router.push('/terminal')}
                    >
                        LAUNCH_TERMINAL <ChevronRight size={16} />
                    </button>
                </div>
            </nav>

            <Hero />

            <section id="features" className="section-recon">
                <div className="section-header">
                    <h2 className="glitch-text" data-text="TACTICAL_RECON_SUITE">TACTICAL_RECON_SUITE</h2>
                    <p className="subtitle">High-fidelity reconnaissance protocols for the digital elite.</p>
                </div>
                <FeatureCards />
            </section>

            <section id="economy" className="section-economy">
                <div className="section-header">
                    <h2 className="glitch-text" data-text="VORTEX_DEFLATIONARY_BURN">VORTEX_DEFLATIONARY_BURN</h2>
                    <p className="subtitle">Fueled by $VTX. Hardened by the Burn Protocol.</p>
                </div>
                <EconomyVisualizer />
            </section>

            <Footer />

            <style jsx global>{`
                .vortex-landing-shell {
                    background: #050505;
                    color: #fff;
                    font-family: 'Inter', sans-serif;
                    overflow-x: hidden;
                }

                .landing-nav {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 80px;
                    z-index: 1000;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    border-bottom: 1px solid transparent;
                }

                .nav-scrolled {
                    background: rgba(5, 5, 5, 0.8);
                    backdrop-filter: blur(12px);
                    height: 70px;
                    border-bottom: 1px solid rgba(0, 255, 234, 0.1);
                }

                .nav-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 40px;
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .logo-icon {
                    width: 32px;
                    height: 32px;
                    background: linear-gradient(135deg, #00ffea, #ff007a);
                    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
                    box-shadow: 0 0 20px rgba(0, 255, 234, 0.4);
                }

                .logo-text {
                    font-size: 24px;
                    font-weight: 800;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                }

                .nav-links {
                    display: flex;
                    gap: 40px;
                }

                .nav-link {
                    color: rgba(255, 255, 255, 0.6);
                    text-decoration: none;
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 2px;
                    transition: all 0.3s ease;
                }

                .nav-link:hover {
                    color: #00ffea;
                    text-shadow: 0 0 8px rgba(0, 255, 234, 0.5);
                }

                .section-header {
                    text-align: center;
                    padding: 80px 0;
                }

                .section-header h2 {
                    font-size: 42px;
                    font-weight: 900;
                    letter-spacing: 6px;
                    margin-bottom: 16px;
                }

                .section-header .subtitle {
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 18px;
                    max-width: 600px;
                    margin: 0 auto;
                }

                .btn-glow {
                    box-shadow: 0 0 30px rgba(0, 255, 234, 0.2);
                    border: 1px solid rgba(0, 255, 234, 0.5);
                }

                .btn-glow:hover {
                    box-shadow: 0 0 50px rgba(0, 255, 234, 0.4);
                    background: #00ffea;
                    color: #000;
                }

                .glitch-text {
                    position: relative;
                }

                @media (max-width: 768px) {
                    .nav-links { display: none; }
                    .nav-content { padding: 0 20px; }
                }
            `}</style>
        </div>
    );
}
