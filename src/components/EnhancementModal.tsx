'use client';
import React, { useState } from 'react';
import { X, Zap, ShieldCheck, Check, Flame, Percent } from 'lucide-react';
import { purchaseEnhancement, claimProject, verifyPayment } from '@/lib/monetizationService';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

export function EnhancementModal({ address, onClose, onPurchase, notify }: EnhancementModalProps) {
    const { connection } = useConnection();
    const { publicKey, connected } = useVortexAuth();
    const { signMessage, sendTransaction } = useWallet();
    const [claiming, setClaiming] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const [useVtx, setUseVtx] = useState(true);

    const handleClaim = async () => {
        if (!publicKey || !signMessage) {
            notify('error', 'WALLET_NOT_CONNECTED');
            return;
        }

        setClaiming(true);
        try {
            const timestamp = Date.now();
            const message = `VORTEX_CLAIM::${address}::${publicKey.toBase58()}::${timestamp}`;
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = await signMessage(messageBytes);
            const signature = bs58.encode(signatureBytes);

            const success = await claimProject(address, publicKey.toBase58(), signature, timestamp);
            if (success) {
                notify('success', 'CLAIM_VERIFIED: Project infrastructure linked.');
                onPurchase();
                onClose();
            } else {
                notify('error', 'CLAIM_DENIED: Signature invalid or protected asset.');
            }
        } catch (e: any) {
            notify('error', `ERROR: ${e.message || 'CLAIM_FAILED'}`);
        } finally {
            setClaiming(false);
        }
    };

    const handleUpgrade = async (tier: 'Enhanced' | 'Elite') => {
        if (!publicKey || !sendTransaction) {
            notify('error', 'WALLET_NOT_CONNECTED');
            return;
        }

        setUpgrading(true);
        try {
            notify('info', `INITIATING_${tier.toUpperCase()}_PROTOCOL...`);
            const txBase64 = await purchaseEnhancement(address, tier, publicKey.toBase58(), useVtx);

            if (!txBase64) {
                notify('error', 'INITIATION_FAILED: Server could not prepare transaction.');
                return;
            }

            const buffer = Buffer.from(txBase64, 'base64');
            let transaction: Transaction | VersionedTransaction;
            try {
                transaction = VersionedTransaction.deserialize(buffer);
            } catch {
                transaction = Transaction.from(buffer);
            }

            const signature = await sendTransaction(transaction, connection);
            notify('info', 'TRANSACTION_BROADCAST: Awaiting settlement...');

            const success = await verifyPayment(signature, address, tier, publicKey.toBase58(), useVtx);

            if (success) {
                notify('success', `${tier.toUpperCase()}_ACTIVATED: Systems operational.`);
                onPurchase();
                onClose();
            } else {
                notify('error', 'VERIFICATION_PENDING: Check status in 30s.');
            }
        } catch (e: any) {
            notify('error', `ERROR: ${e.message || 'UPGRADE_FAILED'}`);
        } finally {
            setUpgrading(false);
        }
    };

    return (
        <div className="vortex-modal-overlay">
            <div className="vortex-modal-content vortex-max-w-2xl">
                <div className="vortex-flex-between vortex-mb-6">
                    <div className="vortex-flex-start vortex-gap-3">
                        <Zap size={24} className="text-vortex-cyan animate-pulse" />
                        <h2 className="vortex-modal-title">Strategic Enhancement Protocol</h2>
                    </div>
                    <button onClick={onClose} className="vortex-icon-btn">
                        <X size={24} />
                    </button>
                </div>

                {/* VTX Economy Toggle */}
                <div className="vtx-economy-banner vortex-mb-6">
                    <div className="vortex-flex-between">
                        <div className="vortex-flex-start vortex-gap-3">
                            <Flame size={20} className="text-vortex-red" />
                            <div>
                                <div className="vortex-text-sm vortex-text-bold">50% DISCOUNT ACTIVE</div>
                                <div className="vortex-text-tiny vortex-text-muted">100% of $VTX payments are physically burned on-chain.</div>
                            </div>
                        </div>
                        <div className="vtx-toggle-container">
                            <span className={`toggle-label ${!useVtx ? 'active' : ''}`}>SOL</span>
                            <button
                                className={`vtx-toggle ${useVtx ? 'vtx-active' : ''}`}
                                onClick={() => setUseVtx(!useVtx)}
                            >
                                <div className="toggle-knob"></div>
                            </button>
                            <span className={`toggle-label ${useVtx ? 'active' : ''}`}>$VTX</span>
                        </div>
                    </div>
                </div>

                <div className="vortex-grid-2 vortex-gap-4 vortex-mb-8">
                    <div className="vortex-panel vortex-border-cyan">
                        <div className="vortex-flex-between vortex-mb-2">
                            <h3 className="vortex-card-title vortex-text-lg">CORE_VERIFIED</h3>
                            <div className="price-tag text-vortex-cyan">{useVtx ? '15 USDC VAL' : '30 USDC'}</div>
                        </div>
                        <p className="vortex-text-xs vortex-text-muted vortex-mb-4">Standard verification for the recon terminal.</p>
                        <div className="vortex-flex-column vortex-gap-2 vortex-mb-6">
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-cyan" /> Verified Badge</div>
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-cyan" /> Social Link Sync</div>
                        </div>
                        <button className="btn-vortex btn-vortex-primary vortex-w-full" onClick={() => handleUpgrade('Enhanced')} disabled={upgrading || claiming}>
                            {upgrading ? 'ACTIVATING...' : 'ENHANCE_PROTOCOL'}
                        </button>
                    </div>

                    <div className="vortex-panel vortex-border-purple vortex-glow-purple">
                        <div className="vortex-flex-between vortex-mb-2">
                            <h3 className="vortex-card-title vortex-text-lg">ELITE_RECON</h3>
                            <div className="price-tag text-vortex-purple">{useVtx ? '60 USDC VAL' : '120 USDC'}</div>
                        </div>
                        <p className="vortex-text-xs vortex-text-muted vortex-mb-4">Military-grade intel and priority global indexing.</p>
                        <div className="vortex-flex-column vortex-gap-2 vortex-mb-6">
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-cyan" /> Live Whale Telemetry</div>
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-purple" /> Global Trending Priority</div>
                        </div>
                        <button className="btn-vortex btn-vortex-primary vortex-bg-purple vortex-w-full" onClick={() => handleUpgrade('Elite')} disabled={upgrading || claiming}>
                            {upgrading ? 'ACTIVATING...' : 'ACTIVATE_ELITE'}
                        </button>
                    </div>
                </div>

                <div className="vortex-input-container">
                    <div className="vortex-flex-between vortex-mb-2">
                        <div className="vortex-flex-start vortex-gap-2">
                            <ShieldCheck size={16} className="text-vortex-yellow" />
                            <span className="vortex-text-xs vortex-text-bold">BURN_PROTOCOL_ENFORCED</span>
                        </div>
                        <div className="vortex-flex-start vortex-gap-2">
                            <input
                                type="password"
                                placeholder="ACCESS_CODE"
                                className="vortex-input-field vortex-text-tiny vortex-w-24 vortex-h-6"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        const code = (e.target as HTMLInputElement).value;
                                        if (code === 'VORTEKE' && publicKey) {
                                            try {
                                                const res = await fetch('/api/auth/provision', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ wallet: publicKey.toBase58(), code })
                                                });
                                                if (res.ok) {
                                                    notify('success', 'ELITE_ACCESS_GRANTED: 7-Day Window Active.');
                                                    onPurchase();
                                                } else {
                                                    notify('error', 'INVALID_ACCESS_CODE');
                                                }
                                            } catch {
                                                notify('error', 'PROVISIONING_ERROR');
                                            }
                                            (e.target as HTMLInputElement).value = '';
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <p className="vortex-text-tiny vortex-text-muted">
                        $VTX payments trigger on-chain burns.
                        Testing with access codes bypasses payments for 7 days.
                    </p>
                </div>
            </div>

            <style jsx>{`
                .vtx-economy-banner {
                    background: rgba(255, 0, 122, 0.05);
                    border: 1px dashed rgba(255, 0, 122, 0.3);
                    padding: 16px;
                    border-radius: 4px;
                }

                .vtx-toggle-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .toggle-label {
                    font-size: 10px;
                    font-weight: 800;
                    color: rgba(255, 255, 255, 0.3);
                    letter-spacing: 1px;
                }

                .toggle-label.active {
                    color: #fff;
                }

                .vtx-toggle {
                    width: 48px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 100px;
                    position: relative;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .vtx-active {
                    background: #ff007a;
                    border-color: #ff007a;
                    box-shadow: 0 0 15px rgba(255, 0, 122, 0.4);
                }

                .toggle-knob {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 18px;
                    height: 18px;
                    background: #fff;
                    border-radius: 50%;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .vtx-active .toggle-knob {
                    transform: translateX(24px);
                }

                .price-tag {
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 1px;
                    padding: 4px 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}
