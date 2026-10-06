'use client';
import React, { useState } from 'react';
import { Check, Edit3, Zap } from 'lucide-react';
import { TokenInfo } from '@/lib/dataService';
import { VortexPanel } from './DesignSystem';
import { UpdateMetadataModal } from './UpdateMetadataModal';

interface DeveloperControlPanelProps {
    token: TokenInfo;
    onUpdate: () => void;
    onUpgrade: () => void;
    notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

const ROWS: [string, (t: TokenInfo) => string | null | undefined][] = [
    ['Website', t => t.socials?.website],
    ['X', t => t.socials?.twitter],
    ['Telegram', t => t.socials?.telegram],
    ['Banner', t => t.bannerURI ? 'Set' : null],
    ['Logo', t => t.iconURI ? 'Set' : null],
    ['Description', t => t.customDescription ? 'Set' : null],
];

/** Shown only to the wallet that claimed this token. */
export function DeveloperControlPanel({ token, onUpdate, onUpgrade, notify }: DeveloperControlPanelProps) {
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const enhanced = token.tier === 'Enhanced';
    const boostUntil = token.boosted && token.boostExpiresAt ? new Date(token.boostExpiresAt) : null;

    return (
        <VortexPanel title="Your project" subTitle="You claimed this profile" glowColor="none">
            <div className="vortex-flex-column vortex-gap-4">
                <dl className="vortex-check-list">
                    <div><dt>Profile</dt><dd>{enhanced ? 'Enhanced' : 'Standard'}</dd></div>
                    <div><dt>Trending boost</dt><dd>{boostUntil ? 'Until ' + boostUntil.toLocaleString() : 'Not active'}</dd></div>
                    {enhanced && ROWS.map(([label, read]) => {
                        const value = read(token);
                        return <div key={label}><dt>{label}</dt><dd className="truncate">{value ? <><Check size={12} aria-hidden /> {value}</> : 'Not set'}</dd></div>;
                    })}
                </dl>
                {enhanced
                    ? <button className="btn-vortex btn-vortex-primary vortex-w-full" onClick={() => setShowUpdateModal(true)}><Edit3 size={16} aria-hidden /> Edit banner, logo and links</button>
                    : <p className="vortex-text-muted">An Enhanced profile adds your banner, logo, links and description to this page.</p>}
                <button className="btn-vortex btn-vortex-secondary vortex-w-full" onClick={onUpgrade}><Zap size={16} aria-hidden /> {enhanced ? 'Boost this token' : 'Upgrade or boost'}</button>
            </div>

            {showUpdateModal && (
                <UpdateMetadataModal
                    token={token}
                    onClose={() => setShowUpdateModal(false)}
                    onSuccess={() => {
                        setShowUpdateModal(false);
                        onUpdate();
                    }}
                    notify={notify}
                />
            )}
        </VortexPanel>
    );
}

