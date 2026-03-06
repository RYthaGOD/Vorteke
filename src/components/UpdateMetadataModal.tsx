'use client';
import React, { useState } from 'react';
import { X, Globe, MessageCircle, ExternalLink, Save, Loader2, ShieldCheck } from 'lucide-react';
import { TokenInfo } from '@/lib/dataService';
import { updateProjectMetadata } from '@/lib/monetizationService';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

interface UpdateMetadataModalProps {
    token: TokenInfo;
    onClose: () => void;
    onSuccess: () => void;
    notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export function UpdateMetadataModal({ token, onClose, onSuccess, notify }: UpdateMetadataModalProps) {
    const { publicKey, signMessage } = useWallet();
    const [submitting, setSubmitting] = useState(false);

    const [website, setWebsite] = useState(token.socials?.website || '');
    const [twitter, setTwitter] = useState(token.socials?.twitter || '');
    const [telegram, setTelegram] = useState(token.socials?.telegram || '');
    const [description, setDescription] = useState(token.customDescription || '');
    const [bannerURI, setBannerURI] = useState(token.bannerURI || '');
    const [iconURI, setIconURI] = useState(token.iconURI || '');

    const handleSave = async () => {
        if (!publicKey || !signMessage) {
            notify('error', 'WALLET_NOT_CONNECTED');
            return;
        }

        // FIX: Validate URIs to prevent XSS via javascript: or data: URI injection
        const isValidHttpsUrl = (url: string) => !url || url.startsWith('https://');
        if (!isValidHttpsUrl(bannerURI)) {
            notify('error', 'INVALID_BANNER_URI: Must start with https://');
            return;
        }
        if (!isValidHttpsUrl(iconURI)) {
            notify('error', 'INVALID_ICON_URI: Must start with https://');
            return;
        }
        if (!isValidHttpsUrl(website)) {
            notify('error', 'INVALID_WEBSITE_URI: Must start with https://');
            return;
        }
        if (description.length > 500) {
            notify('error', 'DESCRIPTION_TOO_LONG: Max 500 characters.');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Generate Signature for Authorization (Anti-Replay Protocol)
            const timestamp = Date.now();
            const message = `VORTEX_UPDATE::${token.address}::${publicKey.toBase58()}::${timestamp}`;
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = await signMessage(messageBytes);
            const signature = bs58.encode(signatureBytes);

            // 2. Transmit Updates
            const success = await updateProjectMetadata(
                token.address,
                publicKey.toBase58(),
                signature,
                timestamp,
                {
                    socials: { website, twitter, telegram },
                    customDescription: description,
                    bannerURI,
                    iconURI
                }
            );

            if (success) {
                notify('success', 'METADATA_SYNCHRONIZED: Project intelligence updated.');
                onSuccess();
            } else {
                notify('error', 'UPDATE_PROTOCOL_FAILURE: Authorization rejected or server error.');
            }
        } catch (e: any) {
            console.error("METADATA_UPDATE_ERROR:", e);
            notify('error', `ERROR: ${e.message || 'TRANSMISSION_FAILED'}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="vortex-modal-overlay">
            <div className="vortex-modal-content vortex-max-w-md">
                <div className="vortex-flex-between vortex-mb-6">
                    <div className="vortex-flex-start vortex-gap-2">
                        <ShieldCheck size={20} className="text-vortex-cyan" />
                        <h2 className="vortex-modal-title">Edit Project Intelligence</h2>
                    </div>
                    <button onClick={onClose} className="vortex-icon-btn">
                        <X size={24} />
                    </button>
                </div>

                <div className="vortex-flex-column vortex-gap-4">
                    <div className="vortex-grid-2 vortex-gap-4">
                        <div className="vortex-input-group">
                            <label className="vortex-label">Website URL</label>
                            <input
                                type="text"
                                className="vortex-input-field"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="vortex-input-group">
                            <label className="vortex-label">Twitter / X</label>
                            <input
                                type="text"
                                className="vortex-input-field"
                                value={twitter}
                                onChange={(e) => setTwitter(e.target.value)}
                                placeholder="https://x.com/..."
                            />
                        </div>
                    </div>

                    <div className="vortex-input-group">
                        <label className="vortex-label">Telegram</label>
                        <input
                            type="text"
                            className="vortex-input-field"
                            value={telegram}
                            onChange={(e) => setTelegram(e.target.value)}
                            placeholder="https://t.me/..."
                        />
                    </div>

                    <div className="vortex-grid-2 vortex-gap-4">
                        <div className="vortex-input-group">
                            <label className="vortex-label">Banner Image URI</label>
                            <input
                                type="text"
                                className="vortex-input-field"
                                value={bannerURI}
                                onChange={(e) => setBannerURI(e.target.value)}
                                placeholder="https://.../banner.png"
                            />
                        </div>
                        <div className="vortex-input-group">
                            <label className="vortex-label">Custom Icon URI</label>
                            <input
                                type="text"
                                className="vortex-input-field"
                                value={iconURI}
                                onChange={(e) => setIconURI(e.target.value)}
                                placeholder="https://.../icon.png"
                            />
                        </div>
                    </div>

                    <div className="vortex-input-group">
                        <label className="vortex-label">Project Description</label>
                        <textarea
                            className="vortex-input-field vortex-min-h-24"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Explain your project..."
                        />
                    </div>

                    <div className="vortex-grid-2 vortex-gap-3 vortex-mt-4">
                        <button className="btn-vortex btn-vortex-outline-cyan" onClick={onClose} disabled={submitting}>
                            CANCEL
                        </button>
                        <button className="btn-vortex btn-vortex-primary" onClick={handleSave} disabled={submitting}>
                            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="vortex-mr-2" />}
                            SAVE_CHANGES
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
