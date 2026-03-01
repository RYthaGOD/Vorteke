'use client';
import React, { useState } from 'react';
import { Settings, Globe, MessageCircle, ExternalLink, Info, Edit3 } from 'lucide-react';
import { TokenInfo } from '@/lib/dataService';
import { UpdateMetadataModal } from './UpdateMetadataModal';

interface DeveloperControlPanelProps {
    token: TokenInfo;
    onUpdate: () => void;
    notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export function DeveloperControlPanel({ token, onUpdate, notify }: DeveloperControlPanelProps) {
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    return (
        <div className="vortex-panel vortex-border-cyan vortex-glow-cyan">
            <div className="vortex-flex-between vortex-mb-6">
                <div className="vortex-flex-start vortex-gap-2">
                    <Settings size={16} className="text-vortex-cyan" />
                    <h3 className="vortex-card-title vortex-text-lg">Developer Control</h3>
                </div>
                <span className="badge-vortex badge-pro">ACTIVE_SESSION</span>
            </div>

            <div className="vortex-flex-column vortex-gap-4">
                <div className="vortex-grid-3 vortex-gap-3">
                    <div className="vortex-input-container vortex-flex-column vortex-gap-1">
                        <span className="vortex-label vortex-text-tiny">Website</span>
                        <div className="vortex-flex-between">
                            <span className="vortex-text-xs vortex-text-muted truncate">{token.socials?.website || 'NOT_SET'}</span>
                            {token.socials?.website && <Globe size={12} className="text-vortex-cyan" />}
                        </div>
                    </div>
                    <div className="vortex-input-container vortex-flex-column vortex-gap-1">
                        <span className="vortex-label vortex-text-tiny">Twitter/X</span>
                        <div className="vortex-flex-between">
                            <span className="vortex-text-xs vortex-text-muted truncate">{token.socials?.twitter || 'NOT_SET'}</span>
                            {token.socials?.twitter && <ExternalLink size={12} className="text-vortex-cyan" />}
                        </div>
                    </div>
                    <div className="vortex-input-container vortex-flex-column vortex-gap-1">
                        <span className="vortex-label vortex-text-tiny">Telegram</span>
                        <div className="vortex-flex-between">
                            <span className="vortex-text-xs vortex-text-muted truncate">{token.socials?.telegram || 'NOT_SET'}</span>
                            {token.socials?.telegram && <MessageCircle size={12} className="text-vortex-cyan" />}
                        </div>
                    </div>
                </div>

                <div className="vortex-input-container">
                    <span className="vortex-label vortex-text-tiny">Project Description</span>
                    <p className="vortex-text-xs vortex-text-muted vortex-line-clamp-2">
                        {token.customDescription || 'No custom description provided. Enhance your project visibility by adding one.'}
                    </p>
                </div>

                <button
                    className="btn-vortex btn-vortex-primary vortex-w-full vortex-mt-2"
                    onClick={() => setShowUpdateModal(true)}
                >
                    <Edit3 size={16} className="vortex-mr-2" />
                    UPDATE_METADATA_PROTOCOLS
                </button>
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
        </div>
    );
}
