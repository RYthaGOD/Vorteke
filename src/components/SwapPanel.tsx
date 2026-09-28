'use client';
import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { TokenInfo } from '@/lib/dataService';
import { ArrowDown, Zap, Settings2, ShieldAlert } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PROTOCOL_FLAT_FEE_SOL, SOL_MINT, JITO_DEFAULT_TIP_LAMPORTS } from '@/lib/constants';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { VortexPanel, VortexButton } from '@/components/DesignSystem';

interface SwapPanelProps {
    token: TokenInfo;
    notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}


import { useVortexAuth } from '@/hooks/useVortexAuth';
import { useSwapBalances, useSwapQuote, useSwapExecution } from '@/hooks/useSwap';

export function SwapPanel({ token, notify }: SwapPanelProps) {
    const [swapMode, setSwapMode] = useState<'BUY' | 'SELL'>('BUY');
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState('Auto');
    const [priorityLevel, setPriorityLevel] = useState<'Normal' | 'Turbo'>('Normal');
    const [showHighImpactWarning, setShowHighImpactWarning] = useState(false);
    const highImpactConfirmed = useRef(false);

    const { isElite } = useVortexAuth();
    const { balance, tokenBalance } = useSwapBalances(token);
    const { quote, loading, error: quoteError } = useSwapQuote(token, amount, slippage, swapMode);
    // FIX: Pass isElite from useVortexAuth instead of letting useSwapExecution re-fetch it
    const { executeSwap, executing, execStatus } = useSwapExecution(token, notify, isElite);

    const { connected } = useWallet();

    useEffect(() => { highImpactConfirmed.current = false; setShowHighImpactWarning(false); }, [amount, slippage, swapMode, token.address, quote]);

    const handleExecute = async () => {
        if (!quote || loading || executing) return;
        if (!connected) {
            notify('error', 'AUTHORIZATION_REQUIRED: Connect wallet to execute order.');
            // Add subtle haptic/visual feedback if needed, but notify is core
            return;
        }

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


    if (token.address === SOL_MINT) return <VortexPanel title="Trade with SOL" subTitle="Your base currency" glowColor="cyan">
        <p className="vortex-disclosure">Open a token to buy or sell it with SOL, or open the USDC market to swap between SOL and USDC.</p>
        <div className="vortex-flex-column vortex-gap-3 vortex-mt-4"><Link className="btn-vortex btn-vortex-primary" href="/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v">Swap SOL / USDC</Link><Link className="btn-vortex btn-vortex-secondary" href="/terminal">Explore token markets</Link></div>
    </VortexPanel>;

    return (
        <VortexPanel
            title="Swap"
            subTitle={`SOL <> ${token.symbol}`}
            glowColor="cyan"
            className="vortex-relative"
        >
            <div className="vortex-flex-between vortex-w-full vortex-mb-4">
                <div className="vortex-flex-start vortex-gap-2">
                    <button
                        className={`vortex-tab ${swapMode === 'BUY' ? 'active' : ''}`}
                        aria-pressed={swapMode === 'BUY'}
                        onClick={() => { setSwapMode('BUY'); setAmount(''); }}
                    >
                        BUY
                    </button>
                    <button
                        className={`vortex-tab ${swapMode === 'SELL' ? 'active' : ''}`}
                        aria-pressed={swapMode === 'SELL'}
                        onClick={() => { setSwapMode('SELL'); setAmount(''); }}
                    >
                        SELL
                    </button>
                </div>
                {isElite ? (
                    <div className="badge-vortex vortex-bg-purple text-vortex-obsidian vortex-animate-pulse vortex-mr-2">
                        ELITE_ACCESS_ACTIVE
                    </div>
                ) : (
                    <button
                        className="vortex-icon-btn vortex-p-1"
                        title="Execution Settings"
                        aria-label="Execution settings"
                        onClick={() => notify('info', 'SETTINGS_PANEL_LOCKED: Acquire the Vortex Elite NFT to unlock.')}
                    >
                        <Settings2 size={16} className="text-vortex-gray" />
                    </button>
                )}
            </div>

            <div className="vortex-flex-between vortex-wrap vortex-gap-3 vortex-mb-4">
                <div className="vortex-flex vortex-wrap vortex-gap-3" role="group" aria-label="Slippage">
                    {['Auto', '0.5', '1.0'].map(val => (
                        <button
                            key={val}
                            type="button"
                            aria-pressed={slippage === val}
                            onClick={() => setSlippage(val)}
                            className={`vortex-pill-tab vortex-text-tiny ${slippage === val ? 'active' : ''}`}
                        >
                            {val === 'Auto' ? 'AUTO' : `${val}%`}
                        </button>
                    ))}
                    <div className="vortex-flex-start vortex-gap-2 vortex-ml-2 vortex-border-left vortex-border-muted vortex-pl-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            aria-label="Custom slippage percent"
                            className="vortex-input-mini vortex-w-12 vortex-text-tiny"
                            placeholder="Custom"
                            value={!['Auto', '0.5', '1.0'].includes(slippage) ? slippage : ''}
                            onChange={(e) => setSlippage(e.target.value.replace(/[^0-9.]/g, ''))}
                        />
                        <span className="vortex-text-tiny vortex-text-muted">%</span>
                    </div>
                </div>
                <div className="vortex-flex vortex-gap-3" role="group" aria-label="Transaction priority">
                    <button
                        type="button"
                        aria-pressed={priorityLevel === 'Normal'}
                        onClick={() => setPriorityLevel('Normal')}
                        className={`vortex-pill-tab vortex-text-tiny ${priorityLevel === 'Normal' ? 'active' : ''}`}
                    >
                        NORMAL
                    </button>
                    <button
                        type="button"
                        aria-pressed={priorityLevel === 'Turbo'}
                        onClick={() => setPriorityLevel('Turbo')}
                        className={`vortex-pill-tab vortex-text-tiny ${priorityLevel === 'Turbo' ? 'active' : ''} text-vortex-cyan`}
                    >
                        <Zap size={10} className="vortex-mr-1" aria-hidden />
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
                            inputMode="decimal"
                            aria-label="Amount to swap"
                            autoComplete="off"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setAmount(e.target.value); }}
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

            {quoteError && <p className="vortex-quote-error" role="alert">{quoteError}</p>}
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

            {!connected ? <div className="vortex-swap-connect"><WalletMultiButton /></div> : <button
                type="button"
                className="btn-vortex btn-vortex-primary vortex-full-width vortex-mt-6"
                disabled={executing || loading || !quote || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
                aria-busy={executing}
                onClick={handleExecute}
            >{executing ? execStatus : loading ? 'Getting quote…' : !quote ? 'Enter an amount' : swapMode === 'BUY' ? 'Buy ' + token.symbol : 'Sell ' + token.symbol}</button>}
            <p className="vortex-disclosure">VORTEX fee: {isElite ? 0 : PROTOCOL_FLAT_FEE_SOL} SOL per swap{isElite ? " (Elite waiver)" : ""}. Network fees are additional.{priorityLevel === "Turbo" && " Turbo adds a " + (JITO_DEFAULT_TIP_LAMPORTS / 1e9) + " SOL tip and higher network priority fees."}</p>
        </VortexPanel>
    );
}
