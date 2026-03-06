'use client';
import React, { useState, useEffect } from 'react';
import { Shield, Zap, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { Modal, VortexButton } from './DesignSystem';
import { purchaseDeepScan, verifyPayment } from '@/lib/monetizationService';
import { useVortexAuth } from '@/hooks/useVortexAuth';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { RPC_ENDPOINTS } from '@/lib/constants';
import { getResilientConnection } from '@/lib/solana/connection';
import { notify } from '@/lib/store';

interface DeepScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokenSymbol: string;
    tokenAddress: string;
}

export function DeepScanModal({ isOpen, onClose, tokenSymbol, tokenAddress }: DeepScanModalProps) {
    const { publicKey, connected } = useVortexAuth();
    const { signTransaction, sendTransaction } = useWallet();
    const [status, setStatus] = useState<'IDLE' | 'INITIATING' | 'SIGNING' | 'VERIFYING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [error, setError] = useState<string | null>(null);

    // FIX: Reset state when modal is closed to prevent re-open showing stale SUCCESS/ERROR state
    const handleClose = () => {
        if (status !== 'INITIATING' && status !== 'SIGNING' && status !== 'VERIFYING') {
            setStatus('IDLE');
            setError(null);
        }
        onClose();
    };

    const handleInitiateScan = async () => {
        if (!publicKey) {
            notify("WALLET_NOT_CONNECTED", "Please connect your wallet to proceed.", "error");
            return;
        }

        if (status === 'SUCCESS') return;

        try {
            setStatus('INITIATING');
            setError(null);

            // 1. Initiate Payment
            const txData = await purchaseDeepScan(tokenAddress, publicKey.toBase58());

            if (txData === 'ELITE_BYPASS') {
                setStatus('SUCCESS');
                notify("ELITE_ACCESS_GRANTED", "Bypassing scan fee via Elite Pass.", "success");
                return;
            }

            if (!txData) {
                throw new Error("Failed to initiate payment transaction.");
            }

            // 2. Decode and Sign
            setStatus('SIGNING');

            // TACTICAL_FIX: Replaced bare Connection() with resilient engine to prevent payment failure on lag
            const connection = await getResilientConnection(async (c) => c);

            // Handle both legacy and versioned transactions
            const buffer = Buffer.from(txData, 'base64');
            let signature: string;

            try {
                // Try versioned first
                const vt = VersionedTransaction.deserialize(buffer);
                signature = await sendTransaction(vt, connection);
            } catch (e) {
                // Fallback to legacy
                const tx = Transaction.from(buffer);
                signature = await sendTransaction(tx, connection);
            }

            // 3. Verify
            setStatus('VERIFYING');
            const isVerified = await verifyPayment(signature, tokenAddress, 'DeepScan', publicKey.toBase58());

            if (isVerified) {
                setStatus('SUCCESS');
                notify("DEEP_SCAN_UNLOCKED", "Holder intelligence clusters are now visible.", "success");
            } else {
                throw new Error("Payment verification failed on-chain.");
            }

        } catch (e: any) {
            console.error("DEEP_SCAN_ERROR:", e);
            setError(e.message || "An unexpected error occurred.");
            setStatus('ERROR');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="DEEP_SCAN_PROTOCOL" size="md">
            <div className="vortex-flex-column vortex-gap-6 vortex-p-4">
                {status === 'IDLE' || status === 'ERROR' ? (
                    <>
                        <div className="vortex-flex-center vortex-mb-2">
                            <div className="pulse-container-cyan">
                                <Shield size={48} className="text-vortex-cyan" />
                            </div>
                        </div>

                        <div className="vortex-text-center">
                            <h3 className="vortex-h3 text-vortex-white vortex-mb-2">Execute Holder Intelligence Sweep</h3>
                            <p className="vortex-text-sm vortex-text-muted">
                                Uncover hidden coordination clusters, dev wallet distributions, and wash trading patterns for <span className="text-vortex-cyan">{tokenSymbol}</span>.
                            </p>
                        </div>

                        <div className="vortex-info-box vortex-bg-obsidian-2">
                            <div className="vortex-flex-between vortex-mb-2">
                                <span className="vortex-text-tiny vortex-text-bold">NETWORK_FEE</span>
                                <span className="vortex-text-tiny text-vortex-cyan">0.02 SOL</span>
                            </div>
                            <div className="vortex-flex-between">
                                <span className="vortex-text-tiny vortex-text-bold">ACCESS_DURATION</span>
                                <span className="vortex-text-tiny text-vortex-cyan">PERMANENT_FOR_THIS_TOKEN</span>
                            </div>
                        </div>

                        {error && (
                            <div className="vortex-error-box vortex-flex-start vortex-gap-2">
                                <AlertTriangle size={14} className="text-vortex-red" />
                                <span className="vortex-text-xs">{error}</span>
                            </div>
                        )}

                        <VortexButton
                            variant="primary"
                            className="vortex-full-width vortex-bg-cyan text-vortex-obsidian"
                            onClick={handleInitiateScan}
                        >
                            <Zap size={16} className="vortex-mr-2" />
                            AUTHORIZE SCAN
                        </VortexButton>
                    </>
                ) : status === 'SUCCESS' ? (
                    <div className="vortex-flex-column vortex-flex-center vortex-py-8 vortex-gap-4">
                        <CheckCircle2 size={64} className="text-vortex-cyan animate-pulse" />
                        <div className="vortex-text-center">
                            <h3 className="vortex-h3 text-vortex-white">SCAN_COMPLETE</h3>
                            <p className="vortex-text-sm vortex-text-muted">Advanced metrics have been injected into the Recom Suite.</p>
                        </div>
                        <VortexButton variant="ghost" onClick={onClose} className="vortex-mt-4">
                            CLOSE_TERMINAL
                        </VortexButton>
                    </div>
                ) : (
                    <div className="vortex-flex-column vortex-flex-center vortex-py-12 vortex-gap-6">
                        <Loader2 size={48} className="text-vortex-cyan animate-spin" />
                        <div className="vortex-text-center">
                            <h3 className="vortex-h3 text-vortex-white">{status}...</h3>
                            <p className="vortex-text-xs vortex-text-muted vortex-ls-widest">DO_NOT_REFRESH_SYSTEM</p>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
