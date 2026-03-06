'use client';

import React, { ReactNode } from 'react';

interface VortexPanelProps {
    children: ReactNode;
    title?: string;
    subTitle?: string;
    className?: string;
    variant?: 'default' | 'glass' | 'blueprint' | 'ghost';
    glowColor?: 'cyan' | 'yellow' | 'purple' | 'none';
    showCorners?: boolean;
}

const CornerAccents = ({ colorClass = '' }) => (
    <>
        <div className={`vortex-corner-tl ${colorClass}`} />
        <div className={`vortex-corner-tr ${colorClass}`} />
        <div className={`vortex-corner-bl ${colorClass}`} />
        <div className={`vortex-corner-br ${colorClass}`} />
    </>
);

/**
 * VortexPanel: The Unified Design Standard
 * Enforces the "Industrial Futurism" aesthetic across the platform.
 */
export const VortexPanel: React.FC<VortexPanelProps> = ({
    children,
    title,
    subTitle,
    className = '',
    variant = 'default',
    glowColor = 'cyan',
    showCorners = false
}) => {
    const variantClass = variant === 'glass' ? 'glass-panel' : variant === 'blueprint' ? 'vortex-blueprint-bg' : variant === 'ghost' ? 'vortex-panel-ghost' : 'vortex-panel';
    const glowClass = glowColor !== 'none' ? `vortex-glow-${glowColor}` : '';
    const cornerAccentClass = glowColor === 'yellow' ? 'vortex-corner-accent-yellow' : '';

    return (
        <section className={`${variantClass} ${glowClass} ${className} ${showCorners ? 'vortex-corners' : ''} animate-fade-in`}>
            {showCorners && <CornerAccents colorClass={cornerAccentClass} />}
            {(title || subTitle) && (
                <div className="vortex-panel-header vortex-mb-4">
                    {title && <h3 className="vortex-card-title vortex-m-0">{title}</h3>}
                    {subTitle && <span className="vortex-text-tiny vortex-text-muted vortex-ls-wide vortex-uppercase">{subTitle}</span>}
                </div>
            )}
            <div className="vortex-panel-content">
                {children}
            </div>
        </section>
    );
};


export const VortexButton: React.FC<{
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: 'primary' | 'secondary' | 'mini' | 'ghost';
    isLoading?: boolean;
    icon?: ReactNode;
}> = ({
    children,
    onClick,
    className = '',
    variant = 'primary',
    isLoading = false,
    icon
}) => {
        const variantClass = `btn-vortex btn-vortex-${variant}`;

        return (
            <button
                onClick={onClick}
                className={`${variantClass} ${className} ${isLoading ? 'vortex-opacity-50' : ''}`}
                disabled={isLoading}
            >
                {icon && <span className="vortex-mr-2">{icon}</span>}
                {isLoading ? 'SYNCING...' : children}
            </button>
        );
    };

export const Modal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg';
}> = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;

    const sizeClass = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-4xl' : 'max-w-2xl';

    return (
        <div className="vortex-modal-overlay">
            <div className={`vortex-modal-container ${sizeClass} animate-slide-up`}>
                <div className="vortex-modal-header">
                    <h2 className="vortex-h3 vortex-m-0">{title}</h2>
                    <button onClick={onClose} className="vortex-modal-close">×</button>
                </div>
                <div className="vortex-modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const VortexLogo: React.FC<{
    size?: 'mini' | 'md' | 'hero';
    className?: string;
    showLabel?: boolean;
}> = ({ size = 'md', className = '', showLabel = false }) => {

    let sizeClasses = 'vortex-w-24 vortex-h-24';
    if (size === 'mini') sizeClasses = 'vortex-w-10 vortex-h-10';
    if (size === 'hero') sizeClasses = 'vortex-w-32 vortex-h-32 md:vortex-w-48 md:vortex-h-48';

    return (
        <div className={`vortex-logo-container ${className} vortex-relative vortex-flex-center`}>
            {/* Pure SVG Implementation: Zero Background, Infinite Fidelity - Optimized for low-end GPUs */}
            <svg
                viewBox="0 0 200 200"
                className={`vortex-singularity-logo ${sizeClasses}`}
            >
                {/* Background Core Engine Glow (Using standard gradient fill) */}
                <circle cx="100" cy="100" r="40" fill="url(#coreGlow)" />

                {/* Mechanical Outer Rings */}
                <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(0, 240, 255, 0.4)" strokeWidth="1" strokeDasharray="4 4" className="animate-spin-slow" />
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(229, 255, 0, 0.3)" strokeWidth="0.5" strokeDasharray="1 8" className="animate-spin-reverse-slow" />

                {/* The "V" Vanguard Structure */}
                <path
                    d="M 20 40 L 100 180 L 180 40 L 140 40 L 100 110 L 60 40 Z"
                    fill="url(#vanguardGradient)"
                    stroke="rgba(0, 240, 255, 0.9)"
                    strokeWidth="1.5"
                    className="vortex-svg-draw"
                />

                {/* Inner Singularity Diamond */}
                <path
                    d="M 100 60 L 125 100 L 100 140 L 75 100 Z"
                    fill="url(#singularityGradient)"
                    className="animate-pulse"
                />

                {/* Energy Spikes / Lightning Details */}
                <path d="M 100 20 L 100 45" stroke="rgba(0, 240, 255, 0.8)" strokeWidth="2" strokeLinecap="round" />
                <path d="M 100 155 L 100 180" stroke="rgba(229, 255, 0, 0.8)" strokeWidth="2" strokeLinecap="round" />
                <path d="M 30 100 L 55 100" stroke="rgba(0, 240, 255, 0.8)" strokeWidth="2" strokeLinecap="round" />
                <path d="M 145 100 L 170 100" stroke="rgba(0, 240, 255, 0.8)" strokeWidth="2" strokeLinecap="round" />

                <defs>
                    <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(0, 240, 255, 0.8)" />
                        <stop offset="50%" stopColor="rgba(0, 240, 255, 0.2)" />
                        <stop offset="100%" stopColor="transparent" />
                    </radialGradient>
                    <linearGradient id="vanguardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(0, 240, 255, 0.2)" />
                        <stop offset="50%" stopColor="rgba(229, 255, 0, 0.2)" />
                        <stop offset="100%" stopColor="rgba(0, 240, 255, 0.2)" />
                    </linearGradient>
                    <linearGradient id="singularityGradient" x1="50%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%" stopColor="#00F0FF" />
                        <stop offset="100%" stopColor="#FFD700" />
                    </linearGradient>
                </defs>
            </svg>

            {showLabel && (
                <div className="vortex-abs-center-x" style={{ bottom: '-20px' }}>
                    <span className="vortex-label text-vortex-cyan vortex-text-tiny animate-pulse uppercase ls-widest" style={{ letterSpacing: '4px', fontSize: '9px', whiteSpace: 'nowrap' }}>NEURAL_MESH_ACTIVE</span>
                </div>
            )}
        </div>
    );
};
