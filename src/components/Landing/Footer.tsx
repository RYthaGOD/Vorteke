'use client';

import React from 'react';
import { Twitter, Github, Globe, ShieldCheck } from 'lucide-react';

export function Footer() {
    return (
        <footer className="vortex-footer">
            <div className="footer-content">
                <div className="footer-brand">
                    <div className="brand-logo">
                        <div className="logo-icon"></div>
                        <span className="logo-text">VORTEX</span>
                    </div>
                    <p className="footer-tagline">Master the Singularity. The premier industrial-grade Solana terminal.</p>
                </div>

                <div className="footer-sections">
                    <div className="footer-group">
                        <h4>STRATEGIC_CMD</h4>
                        <a href="https://github.com/RYthaGOD/Vorteke" target="_blank">Documentation</a>
                        <a href="https://github.com/RYthaGOD/Vorteke" target="_blank">Open Source</a>
                        <a href="#">Security Audit</a>
                    </div>

                    <div className="footer-group">
                        <h4>TACTICAL_SOCIALS</h4>
                        <a href="https://x.com/moneybag_fin" target="_blank" className="social-link">
                            <Twitter size={14} /> @moneybag_fin (Lead Dev)
                        </a>
                        <a href="https://x.com/SusanooSOL" target="_blank" className="social-link">
                            <Twitter size={14} /> @SusanooSOL (Ops)
                        </a>
                        <a href="https://x.com/VortekeSOL" target="_blank" className="social-link">
                            <Twitter size={14} /> Official X
                        </a>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <div className="copyright">
                    Â© 2026 VORTEX PROTOCOL. ALL_RIGHTS_RESERVED.
                </div>
                <div className="uptime-status">
                    <div className="status-indicator"></div>
                    SYSTEM_STABLE: 99.9%
                </div>
            </div>

            <style jsx>{`
                .vortex-footer {
                    background: #000;
                    padding: 80px 40px 40px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }

                .footer-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 80px;
                    gap: 40px;
                }

                .brand-logo {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .logo-icon {
                    width: 24px;
                    height: 24px;
                    background: linear-gradient(135deg, #00ffea, #ff007a);
                    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
                }

                .logo-text {
                    font-size: 20px;
                    font-weight: 800;
                    letter-spacing: 2px;
                }

                .footer-tagline {
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 14px;
                    max-width: 300px;
                    line-height: 1.6;
                }

                .footer-sections {
                    display: flex;
                    gap: 80px;
                }

                .footer-group h4 {
                    font-size: 12px;
                    font-weight: 800;
                    letter-spacing: 2px;
                    color: #fff;
                    margin-bottom: 24px;
                }

                .footer-group a {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: rgba(255, 255, 255, 0.5);
                    text-decoration: none;
                    font-size: 13px;
                    margin-bottom: 12px;
                    transition: color 0.3s ease;
                }

                .footer-group a:hover {
                    color: #00ffea;
                }

                .footer-bottom {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding-top: 40px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .copyright {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.3);
                    letter-spacing: 1px;
                }

                .uptime-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    color: rgba(0, 255, 234, 0.6);
                    font-weight: 700;
                    letter-spacing: 1px;
                }

                .status-indicator {
                    width: 6px;
                    height: 6px;
                    background: #00ffea;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #00ffea;
                }

                @media (max-width: 768px) {
                    .footer-content { flex-direction: column; }
                    .footer-sections { flex-direction: column; gap: 40px; }
                    .footer-bottom { flex-direction: column; gap: 20px; text-align: center; }
                }
            `}</style>
        </footer>
    );
}
