'use client';
import React, { useState, useEffect, useRef } from 'react';
import { TokenInfo, formatPercent } from '@/lib/dataService';
import { ArrowDown, Zap, ShieldCheck, Settings2, ShieldAlert } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey, VersionedTransaction, TransactionMessage, AddressLookupTableAccount, SystemProgram } from '@solana/web3.js';
import { JUPITER_QUOTE_API, SOL_MINT, TREASURY_SWAPS, PROTOCOL_FLAT_FEE_SOL, PROTOCOL_FLAT_FEE_LAMPORTS } from '@/lib/constants';
import { captureException } from '@/lib/logger';
import { getDflowQuote, DflowQuote } from '@/lib/solana/dflowService';
import { verifyEliteAccess } from '@/lib/monetizationService';
import { VortexPanel, VortexButton } from '@/components/DesignSystem';

interface SwapPanelProps {
    token: TokenInfo;
    notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}

interface QuoteInfo {
    outAmount: number;
    priceImpact: number;
    feeBps: number;
}

import { useSwapBalances, useSwapQuote, useSwapExecution } from '@/hooks/useSwap';

export function SwapPanel({ token, notify }: SwapPanelProps) {
    const [swapMode, setSwapMode] = useState<'BUY' | 'SELL'>('BUY');
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState('Auto');
    const [priorityLevel, setPriorityLevel] = useState<'Normal' | 'Turbo'>('Normal');
    const [showHighImpactWarning, setShowHighImpactWarning] = useState(false);
    const highImpactConfirmed = useRef(false);

    const { balance, tokenBalance } = useSwapBalances(token);
    const { quote, dflowQuote, loading } = useSwapQuote(token, amount, slippage, swapMode);
    const { executeSwap, executing, execStatus, isElite } = useSwapExecution(token, notify);

    const handleExecute = async () => {
        if (quote && quote.priceImpact > 15 && !highImpactConfirmed.current) {
            setShowHighImpactWarning(true);
            return;
        }

        const success = await executeSwap(amount, swapMode, quote, slippage, priorityLevel);
        if (success) {
            setAmount('');
            highImpactConfirmed.current = false;
        }
    };

    return (
        <VortexPanel
            title="EXECUTE_ORDER"
            subTitle={`SOL <> ${token.symbol}`}
            glowColor="cyan"
            className="vortex-relative"
        >
            <div className="vortex-flex-between vortex-w-full vortex-mb-4">
                <div className="vortex-flex-start vortex-gap-2">
                    <button
                        className={`vortex-tab ${swapMode === 'BUY' ? 'active' : ''}`}
                        onClick={() => { setSwapMode('BUY'); setAmount(''); }}
                    >
                        BUY
                    </button>
                    <button
                        className={`vortex-tab ${swapMode === 'SELL' ? 'active' : ''}`}
                        onClick={() => { setSwapMode('SELL'); setAmount(''); }}
                    >
                        SELL
                    </button>
                </div>
                {isElite ? (
                    <div className="badge-vortex vortex-bg-purple text-vortex-obsidian vortex-animate-pulse vortex-mr-2">
                        SYNDICATE_ACTIVE
                    </div>
                ) : (
                    <button
                        className="vortex-icon-btn vortex-p-1"
                        title="Execution Settings"
                        onClick={() => notify('info', 'SETTINGS_PANEL_LOCKED: Acquire the Vortex Elite NFT to unlock.')}
                    >
                        <Settings2 size={16} className="text-vortex-gray" />
                    </button>
                )}
            </div>

            <div className="vortex-flex-between vortex-mb-4">
                <div className="vortex-flex vortex-gap-3">
                    {['Auto', '0.5', '1.0'].map(val => (
                        <button
                            key={val}
                            onClick={() => setSlippage(val)}
                            className={`vortex-pill-tab vortex-text-tiny ${slippage === val ? 'active' : ''}`}
                        >
                            {val === 'Auto' ? 'AUTO' : `${val}%`}
                        </button>
                    ))}
                    <div className="vortex-flex-start vortex-gap-2 vortex-ml-2 vortex-border-left vortex-border-muted vortex-pl-2">
                        <input
                            type="text"
                            className="vortex-input-mini vortex-w-12 vortex-text-tiny"
                            placeholder="Custom"
                            value={!['Auto', '0.5', '1.0'].includes(slippage) ? slippage : ''}
                            onChange={(e) => setSlippage(e.target.value.replace(/[^0-9.]/g, ''))}
                        />
                        <span className="vortex-text-tiny vortex-text-muted">%</span>
                    </div>
                </div>
                <div className="vortex-flex vortex-gap-3">
                    <button
                        onClick={() => setPriorityLevel('Normal')}
                        className={`vortex-pill-tab vortex-text-tiny ${priorityLevel === 'Normal' ? 'active' : ''}`}
                    >
                        NORMAL
                    </button>
                    <button
                        onClick={() => setPriorityLevel('Turbo')}
                        className={`vortex-pill-tab vortex-text-tiny ${priorityLevel === 'Turbo' ? 'active' : ''} text-vortex-cyan`}
                    >
                        <Zap size={10} className="vortex-mr-1" />
                        TURBO
                    </button>
                </div>
            </div>

            <div className="vortex-flex-column vortex-gap-3">
                {/* Input Area */}
                <div className="vortex-input-container">
                    <div className="vortex-flex-between vortex-mb-2">
                        <span className="vortex-label vortex-m-0">{swapMode === 'BUY' ? 'Sell SOL' : `Sell ${token.symbol}`}</span>
                        <div className="vortex-flex vortex-gap-2">
                            <span className="vortex-label vortex-m-0">
                                {swapMode === 'BUY' ? (balance?.toFixed(4) || '0.00') : (tokenBalance?.toLocaleString() || '0')}
                            </span>
                            <button
                                className="vortex-text-tiny text-vortex-yellow"
                                onClick={() => setAmount(swapMode === 'BUY' ? (balance ? Math.max(0, balance - 0.015).toString() : '0') : (tokenBalance?.toString() || '0'))}
                            >
                                MAX
                            </button>
                        </div>
                    </div>
                    <div className="vortex-flex-between">
                        <input
                            type="text"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="vortex-input-field"
                        />
                        <div className="vortex-flex-start vortex-gap-2">
                            <span className="vortex-text-bold vortex-text-sm">{swapMode === 'BUY' ? 'SOL' : token.symbol}</span>
                        </div>
                    </div>
                </div>

                <div className="vortex-flex-center vortex-relative vortex-z-10 vortex-m-neg-12">
                    <div className="vortex-bg-obsidian vortex-p-1.5 vortex-border-radius-full vortex-border vortex-border-vortex">
                        <ArrowDown size={14} className="text-vortex-yellow" />
                    </div>
                </div>

                {/* Output Area */}
                <div className="vortex-input-container">
                    <div className="vortex-flex-between vortex-mb-2">
                        <span className="vortex-label vortex-m-0">{swapMode === 'BUY' ? `Buy ${token.symbol}` : 'Receive SOL'}</span>
                    </div>
                    <div className="vortex-flex-between">
                        <div className={`text-vortex-amount ${amount ? 'vortex-text-bright' : 'vortex-text-muted-20'} vortex-font-mono`}>
                            {loading ? '...' : (quote ? quote.outAmount.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0.00')}
                        </div>
                        <div className="vortex-flex-start vortex-gap-2">
                            <span className="vortex-text-bold vortex-text-sm">{swapMode === 'BUY' ? token.symbol : 'SOL'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* High Impact Warning */}
            {showHighImpactWarning && (
                <div className="vortex-mt-4 vortex-p-4 vortex-bg-red vortex-bg-opacity-10 vortex-border vortex-border-vortex-red vortex-border-radius-md">
                    <div className="vortex-flex-start vortex-gap-2 vortex-mb-2">
                        <ShieldAlert size={16} className="text-vortex-red" />
                        <span className="vortex-text-xs vortex-text-red vortex-text-bold">CRITICAL_PRICE_IMPACT</span>
                    </div>
                    <p className="vortex-text-tiny vortex-text-muted vortex-mb-4">
                        Execution will result in a {quote?.priceImpact}% slippage loss. Route liquidity is extremely shallow.
                    </p>
                    <div className="vortex-grid-2 vortex-gap-3">
                        <VortexButton variant="ghost" className="vortex-text-tiny" onClick={() => setShowHighImpactWarning(false)}>ABORT</VortexButton>
                        <VortexButton variant="primary" className="vortex-text-tiny" onClick={() => { highImpactConfirmed.current = true; setShowHighImpactWarning(false); handleExecute(); }}>CONFIRM</VortexButton>
                    </div>
                </div>
            )}

            <VortexButton
                isLoading={executing}
                onClick={handleExecute}
                className="vortex-full-width vortex-mt-6 vortex-h-12 vortex-text-bold"
                icon={<Zap size={18} fill="currentColor" />}
            >
                {executing ? execStatus : `EXECUTE ORDER (${PROTOCOL_FLAT_FEE_SOL} SOL VORTEX FEE)`}
            </VortexButton>

            <div className="vortex-flex-center vortex-mt-4 vortex-gap-2 vortex-text-muted vortex-text-xs">
                <ShieldCheck size={12} />
                MEV PROTECTED TERMINAL
            </div>
        </VortexPanel>
    );
}
