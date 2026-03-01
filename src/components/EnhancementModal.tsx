'use client';
import React, { useState } from 'react';
import { X, Zap, ShieldCheck, Check, Globe, Layers, Cpu, Users } from 'lucide-react';
import { purchaseEnhancement, claimProject, verifyPayment } from '@/lib/monetizationService';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

interface EnhancementModalProps {
    address: string;
    onClose: () => void;
    onPurchase: () => void;
    notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export function EnhancementModal({ address, onClose, onPurchase, notify }: EnhancementModalProps) {
    const { connection } = useConnection();
    const { publicKey, signMessage, sendTransaction } = useWallet();
    const [claiming, setClaiming] = useState(false);

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

    const handleEliteUpgrade = async () => {
        if (!publicKey || !sendTransaction) {
            notify('error', 'WALLET_NOT_CONNECTED: A compatible Solana wallet is required.');
            return;
        }

        try {
            notify('info', 'INITIATING_ELITE_PROTOCOL...');
            const txBase64 = await purchaseEnhancement(address, 'Elite', publicKey.toBase58());

            if (!txBase64) {
                notify('error', 'INITIATION_FAILED: Server could not prepare transaction.');
                return;
            }

            // 1. Recover Transaction (Support both v0 and legacy formats)
            let transaction: Transaction | VersionedTransaction;
            const buffer = Buffer.from(txBase64, 'base64');
            try {
                transaction = VersionedTransaction.deserialize(buffer);
            } catch {
                transaction = Transaction.from(buffer);
            }

            // 2. Sign and Send via Provider Adapter (Multi-Wallet Support)
            const signature = await sendTransaction(transaction, connection);

            notify('info', 'TRANSACTION_BROADCAST: Awaiting Solana settlement...');

            // 3. Verify on Backup/Server
            const success = await verifyPayment(signature, address, 'Elite', publicKey.toBase58());

            if (success) {
                notify('success', 'ELITE_PROTOCOL_ACTIVATED: Recon systems operational.');
                onPurchase();
                onClose();
            } else {
                notify('error', 'VERIFICATION_TIMEOUT: Please refresh in 30s to confirm status.');
            }
        } catch (e: any) {
            console.error("ELITE_UPGRADE_ERROR:", e);
            notify('error', `ERROR: ${e.message || 'UPGRADE_FAILED'}`);
        }
    };

    return (
        <div className="vortex-modal-overlay">
            <div className="vortex-modal-content vortex-max-w-lg">
                <div className="vortex-flex-between vortex-mb-6">
                    <div className="vortex-flex-start vortex-gap-3">
                        <Zap size={24} className="text-vortex-cyan animate-pulse" />
                        <h2 className="vortex-modal-title">Upgrade Project Intelligence</h2>
                    </div>
                    <button onClick={onClose} className="vortex-icon-btn">
                        <X size={24} />
                    </button>
                </div>

                <div className="vortex-grid-2 vortex-gap-4 vortex-mb-8">
                    <div className="vortex-panel vortex-border-cyan">
                        <h3 className="vortex-card-title vortex-text-lg vortex-mb-2">CORE_VERIFICATION</h3>
                        <p className="vortex-text-xs vortex-text-muted vortex-mb-4">Claim terminal ownership. Unlock social routing and global metadata sync.</p>
                        <div className="vortex-flex-column vortex-gap-2 vortex-mb-6">
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-cyan" /> Verified Terminal Badge</div>
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-cyan" /> Social Routing Links</div>
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-cyan" /> Custom Project Intel</div>
                        </div>
                        <button className="btn-vortex btn-vortex-primary vortex-w-full" onClick={handleClaim} disabled={claiming}>
                            {claiming ? 'VERIFYING...' : 'CLAIM_NOW_30_USDC_EQ'}
                        </button>
                    </div>

                    <div className="vortex-panel vortex-border-purple vortex-glow-purple">
                        <h3 className="vortex-card-title vortex-text-lg vortex-mb-2">ELITE_RECON_SUITE</h3>
                        <p className="vortex-text-xs vortex-text-muted vortex-mb-4">Military-grade intelligence. Unlock live whale telemetry, raw instruction decoding, and priority indexing in Trending Discovery.</p>
                        <div className="vortex-flex-column vortex-gap-2 vortex-mb-6">
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-cyan" /> Live Whale Telemetry</div>
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-purple" /> Priority Trending Indexing</div>
                            <div className="vortex-flex-start vortex-gap-2 vortex-text-xs"><Check size={14} className="text-vortex-cyan" /> Bundle Risk Analysis</div>
                        </div>
                        <button className="btn-vortex btn-vortex-primary vortex-bg-purple vortex-w-full" onClick={handleEliteUpgrade}>ACTIVATE_ELITE (120_USDC_EQ)</button>
                    </div>
                </div>

                <div className="vortex-input-container">
                    <div className="vortex-flex-start vortex-gap-2 vortex-mb-2">
                        <ShieldCheck size={16} className="text-vortex-yellow" />
                        <span className="vortex-text-xs vortex-text-bold">SECURE_VERIFICATION</span>
                    </div>
                    <p className="vortex-text-tiny vortex-text-muted">
                        Claims require a cryptographic signature from the token&apos;s Update Authority or Deployer wallet.
                        Protected assets (USDC, SOL, JUP) cannot be claimed.
                    </p>
                </div>
            </div>
        </div>
    );
}
