'use client';

import React, { ReactNode } from 'react';

interface VortexPanelProps {
    children: ReactNode;
    title?: string;
    subTitle?: string;
    className?: string;
    variant?: 'default' | 'glass' | 'blueprint';
    glowColor?: 'cyan' | 'yellow' | 'none';
}

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
    glowColor = 'cyan'
}) => {
    const variantClass = variant === 'glass' ? 'vortex-glass-morph' : variant === 'blueprint' ? 'vortex-blueprint-bg' : 'vortex-panel';
    const glowClass = glowColor !== 'none' ? `vortex-glow-${glowColor}` : '';

    return (
        <section className={`${variantClass} ${glowClass} ${className} animate-fade-in`}>
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
