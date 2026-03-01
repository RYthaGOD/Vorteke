'use client';
import React, { useState } from 'react';
import { X, ShieldAlert, Cpu, Check, Activity, Search, AlertTriangle, Key } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { RPC_ENDPOINTS } from '@/lib/constants';
import { purchaseDeepScan, verifyPayment } from '@/lib/monetizationService';
import { useNotificationStore } from '@/lib/store';

interface DeepScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokenSymbol: string;
    tokenAddress: string;
}

const mockTopHolders = [
    { address: '8Fkx...P2Z9', balance: '4.2', fundedBy: 'KuCoin 3', tags: ['DEV_FUNDED', 'SNIPER'] },
    { address: '3Tqp...m9Qw', balance: '3.8', fundedBy: 'Binance', tags: ['WHALE'] },
    { address: '9xRq...z1kL', balance: '3.1', fundedBy: 'Mexc', tags: ['BOT'] },
    { address: '4Pzy...c7Nm', balance: '2.9', fundedBy: 'KuCoin 3', tags: ['DEV_FUNDED', 'SNIPER'] },
    { address: '7Kjm...v5Xq', balance: '2.5', fundedBy: 'Raydium', tags: [] },
    { address: '5Wpn...b4Hj', balance: '2.1', fundedBy: 'KuCoin 3', tags: ['DEV_FUNDED'] }
];

export function DeepScanModal({ isOpen, onClose, tokenSymbol, tokenAddress }: DeepScanModalProps) {
    const wallet = useWallet();
    const notify = useNotificationStore((state) => state.notify);

    const [isScanning, setIsScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);
    const [progress, setProgress] = useState(0);

    if (!isOpen) return null;

    const handleDeepScan = async () => {
        if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
            notify('error', 'WALLET_DISCONNECTED: Connection required to initialize scan.');
            return;
        }

        setIsScanning(true);
        setProgress(10);

        try {
            // 1. Fetch Transaction from Backend (or check for Elite Bypass)
            const transactionBase64 = await purchaseDeepScan(tokenAddress, wallet.publicKey.toString());

            if (transactionBase64 === 'ELITE_BYPASS') {
                setProgress(100);
                setScanComplete(true);
                notify('success', 'ELITE_OVERRIDE: Intelligence unlocked instantly.');
                return;
            }

            if (!transactionBase64) throw new Error("Could not initialize scan payment.");
            setProgress(30);

            // 2. Deserialize Transaction
            const transactionBuf = Buffer.from(transactionBase64, 'base64');
            const transaction = VersionedTransaction.deserialize(transactionBuf);

            // 3. User Signs Transaction
            setProgress(50);
            notify('info', 'AWAITING_SIGNATURE: Approve the 0.02 SOL scan fee.');
            const signedTx = await wallet.signTransaction(transaction);

            // 4. Send Transaction
            setProgress(70);
            const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_PRIMARY || RPC_ENDPOINTS[0];
            const connection = new Connection(endpoint, 'confirmed');

            const rawTransaction = signedTx.serialize();
            const signature = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                maxRetries: 3
            });

            // 5. Verify Payment on Backend
            setProgress(90);
            const isVerified = await verifyPayment(signature, tokenAddress, 'DeepScan', wallet.publicKey.toString());

            if (!isVerified) throw new Error("Payment verification failed. Intel locked.");

            setProgress(100);
            setScanComplete(true);
            notify('success', 'SCAN_COMPLETE: Encrypted intelligence unlocked.');
        } catch (e: any) {
            console.error("DEEP_SCAN_ERROR:", e);
            notify('error', e.message || 'Scan initialization failed.');
            setIsScanning(false);
            setProgress(0);
        }
    };

    return (
        <div className="vortex-modal-overlay">
            <div className="vortex-modal-content vortex-w-max-3xl">
                <div className="vortex-flex-between vortex-mb-4">
                    <div className="vortex-flex-start vortex-gap-2">
                        <Search size={20} className="text-vortex-cyan" />
                        <h2 className="vortex-card-title vortex-text-lg vortex-m-0">DEEP_BUNDLE_SCAN</h2>
                    </div>
                    <button className="vortex-icon-btn" onClick={onClose}><X size={20} /></button>
                </div>

                {!scanComplete ? (
                    <div className="vortex-flex-column vortex-gap-4">
                        <div className="vortex-p-4 vortex-bg-obsidian-soft vortex-border-radius-md vortex-border vortex-border-dashed border-vortex-cyan">
                            <p className="vortex-text-sm vortex-text-muted vortex-m-0 vortex-mb-2">
                                Surface-level metrics show the percentage of supply clustered in the launch block. A <span className="text-vortex-cyan">Deep Bundle Scan</span> decrypts the exact wallets, tracing their funding sources to expose hidden developer clusters, sniper bot networks, and insider rings.
                            </p>
                            <div className="vortex-text-xs vortex-text-muted">Target Asset: <span className="vortex-text-bold text-vortex-bright">{tokenSymbol}</span></div>
                        </div>

                        <div className="vortex-grid-3 vortex-gap-4">
                            <div className="vortex-panel vortex-border-cyan vortex-p-3">
                                <Key size={16} className="text-vortex-cyan vortex-mb-2" />
                                <div className="vortex-text-tiny vortex-text-bold">UNMASK WALLETS</div>
                                <div className="vortex-text-tiny vortex-text-muted">Reveal exact supply of the top 50 cluster wallets.</div>
                            </div>
                            <div className="vortex-panel vortex-border-cyan vortex-p-3">
                                <AlertTriangle size={16} className="text-vortex-yellow vortex-mb-2" />
                                <div className="vortex-text-tiny vortex-text-bold">FUNDING TRACING</div>
                                <div className="vortex-text-tiny vortex-text-muted">Identify if multiple wallets were funded by the same CEX address.</div>
                            </div>
                            <div className="vortex-panel vortex-border-cyan vortex-p-3">
                                <Cpu size={16} className="text-vortex-cyan vortex-mb-2" />
                                <div className="vortex-text-tiny vortex-text-bold">SNIPER DETECTION</div>
                                <div className="vortex-text-tiny vortex-text-muted">Automatically flag known MEV and sniper bot contracts.</div>
                            </div>
                        </div>

                        {isScanning ? (
                            <div className="vortex-p-6 vortex-text-center vortex-bg-obsidian-soft vortex-border-radius-md">
                                <Activity size={32} className="vortex-text-cyan vortex-animate-pulse vortex-m-auto vortex-mb-4" />
                                <div className="vortex-text-sm vortex-text-bold vortex-mb-2">EXECUTING DEEP SCAN SEQUENCE</div>
                                <div className="vortex-progress-bg vortex-progress-sm vortex-mb-2">
                                    <div className="vortex-progress-fill vortex-bg-cyan transition-width" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="vortex-text-tiny vortex-text-muted vortex-font-mono">{progress}% - VERIFYING_TRANSACTION_PAYMENT...</div>
                            </div>
                        ) : (
                            <button className="btn-vortex btn-vortex-primary vortex-bg-cyan vortex-w-full vortex-text-lg vortex-py-4" onClick={handleDeepScan}>
                                INITIATE SCAN (0.02 SOL)
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="vortex-flex-column vortex-gap-4 animate-fade-in">
                        <div className="vortex-p-3 vortex-bg-green vortex-bg-opacity-20 vortex-border vortex-border-vortex-green vortex-text-green vortex-text-center vortex-border-radius-md">
                            <Check size={24} className="vortex-m-auto vortex-mb-2" />
                            <div className="vortex-text-bold">SCAN_COMPLETE: INTELLIGENCE_DECRYPTED</div>
                        </div>

                        <div className="vortex-panel">
                            <h3 className="vortex-text-sm vortex-text-bold vortex-mb-3">TOP CLUSTERED WALLETS</h3>
                            <div className="vortex-table-container">
                                <table className="vortex-table vortex-w-full">
                                    <thead>
                                        <tr>
                                            <th className="vortex-text-left vortex-text-tiny vortex-text-muted vortex-p-2">ADDRESS</th>
                                            <th className="vortex-text-right vortex-text-tiny vortex-text-muted vortex-p-2">SUPPLY %</th>
                                            <th className="vortex-text-left vortex-text-tiny vortex-text-muted vortex-p-2">FUNDING SOURCE</th>
                                            <th className="vortex-text-right vortex-text-tiny vortex-text-muted vortex-p-2">FLAGS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mockTopHolders.map((holder, idx) => (
                                            <tr key={idx} className="vortex-border-b border-vortex-obsidian">
                                                <td className="vortex-p-2 vortex-font-mono vortex-text-sm">{holder.address}</td>
                                                <td className="vortex-p-2 vortex-text-right vortex-text-sm text-vortex-cyan">{holder.balance}%</td>
                                                <td className="vortex-p-2 vortex-text-sm text-vortex-muted">{holder.fundedBy}</td>
                                                <td className="vortex-p-2 vortex-text-right">
                                                    <div className="vortex-flex-end vortex-gap-1">
                                                        {holder.tags.map(tag => (
                                                            <span key={tag} className={`recon-tag-safe vortex-text-tiny ${tag === 'DEV_FUNDED' ? 'vortex-text-red border-vortex-red' : ''}`}>{tag}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
