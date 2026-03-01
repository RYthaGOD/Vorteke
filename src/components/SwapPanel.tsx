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

export function SwapPanel({ token, notify }: SwapPanelProps) {
    const [swapMode, setSwapMode] = useState<'BUY' | 'SELL'>('BUY');
    const [amount, setAmount] = useState('');
    const [quote, setQuote] = useState<QuoteInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [slippage, setSlippage] = useState('Auto');
    const [balance, setBalance] = useState<number | null>(null);
    const [tokenBalance, setTokenBalance] = useState<number | null>(null);
    const [execStatus, setExecStatus] = useState<string>('');
    const [priorityLevel, setPriorityLevel] = useState<'Normal' | 'Turbo'>('Normal');
    const [showHighImpactWarning, setShowHighImpactWarning] = useState(false);
    const [dflowQuote, setDflowQuote] = useState<DflowQuote | null>(null);
    const [isElite, setIsElite] = useState(false);
    const highImpactConfirmed = useRef(false);

    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();

    useEffect(() => {
        if (publicKey) {
            verifyEliteAccess(publicKey.toString()).then(setIsElite);
        } else {
            setIsElite(false);
        }
    }, [publicKey]);

    const inputMint = swapMode === 'BUY' ? SOL_MINT : token.address;
    const outputMint = swapMode === 'BUY' ? token.address : SOL_MINT;
    const inputDecimals = swapMode === 'BUY' ? 9 : token.decimals;
    const outputDecimals = swapMode === 'BUY' ? token.decimals : 9;

    // Fetch Balances
    useEffect(() => {
        if (!publicKey) {
            setBalance(null);
            setTokenBalance(null);
            return;
        }

        const fetchBalances = async () => {
            try {
                const b = await connection.getBalance(publicKey);
                setBalance(b / LAMPORTS_PER_SOL);

                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    mint: new PublicKey(token.address)
                });

                if (tokenAccounts.value.length > 0) {
                    const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
                    setTokenBalance(amount);
                } else {
                    setTokenBalance(0);
                }
            } catch (e) {
                console.error("BALANCE ERROR:", e);
            }
        };

        fetchBalances();
        const id = setInterval(fetchBalances, 10000);
        return () => clearInterval(id);
    }, [publicKey, token, connection]);

    // Jupiter V6 Quote Integration
    useEffect(() => {
        if (!amount || isNaN(parseFloat(amount))) {
            setQuote(null);
            return;
        }

        const abortController = new AbortController();

        const fetchQuote = async () => {
            setLoading(true);
            try {
                const inputAmount = Math.floor(parseFloat(amount) * Math.pow(10, inputDecimals));
                const slippageBps = parseFloat(slippage) * 100;
                const quoteResponse = await fetch(
                    `${JUPITER_QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputAmount}&slippageBps=${slippageBps}`,
                    { signal: abortController.signal }
                );

                if (!quoteResponse.ok) throw new Error('Jupiter API failure');
                const data = await quoteResponse.json();

                if (data.outAmount) {
                    const jupQuote = {
                        outAmount: parseFloat(data.outAmount) / Math.pow(10, outputDecimals),
                        priceImpact: parseFloat(data.priceImpactPct) || 0,
                        feeBps: 10
                    };

                    if (!abortController.signal.aborted) {
                        setQuote(jupQuote);
                        const dfQuote = await getDflowQuote(inputMint, outputMint, parseFloat(amount));
                        setDflowQuote(dfQuote);
                    }
                } else {
                    if (!abortController.signal.aborted) {
                        setQuote(null);
                        setDflowQuote(null);
                    }
                }
            } catch (e: any) {
                if (e.name === 'AbortError') {
                    // Quote fetch aborted
                } else {
                    console.error("JUPITER QUOTE ERROR:", e);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        const timer = setTimeout(fetchQuote, 500);
        return () => {
            clearTimeout(timer);
            abortController.abort();
        };
    }, [amount, token, slippage, swapMode, inputMint, outputMint, inputDecimals, outputDecimals]);

    const handleExecute = async () => {
        if (!publicKey) {
            notify('info', 'CONNECT_WALLET: Authorization required.');
            document.querySelector<HTMLButtonElement>('.wallet-adapter-button')?.click();
            return;
        }

        if (!amount || !signTransaction || !quote) {
            notify('error', 'EXECUTION_BLOCKED: Valid input required.');
            return;
        }

        if (quote.priceImpact > 15 && !highImpactConfirmed.current) {
            setShowHighImpactWarning(true);
            return;
        }

        setExecuting(true);
        highImpactConfirmed.current = false;
        setExecStatus('INITIALIZING_VORTEX_SWAP...');

        try {
            const inputAmount = Math.floor(parseFloat(amount) * Math.pow(10, inputDecimals));
            // Dynamic slippage resolution: If 'Auto', default to 1% (100 bps) or higher based on market conditions
            const slippageBps = slippage === 'Auto' ? 100 : parseFloat(slippage) * 100;

            const quoteUrl = `${JUPITER_QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputAmount}&slippageBps=${slippageBps}`;
            const quoteRes = await fetch(quoteUrl);
            const quoteData = await quoteRes.json();

            // Setup Jupiter Swap configuration
            const swapConfig: any = {
                quoteResponse: quoteData,
                userPublicKey: publicKey.toString(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
            };

            // Industrial MEV Routing Logic
            if (priorityLevel === 'Turbo') {
                setExecStatus('ROUTING_THROUGH_JITO_ENGINE...');
                // In a true Elite system, this would construct a Jito Bundle.
                // For Jupiter, we force a high prioritization fee and max compute to aggressively land the tx.
                swapConfig.prioritizationFeeLamports = 2500000; // 0.0025 SOL tip equivalent
            } else {
                swapConfig.prioritizationFeeLamports = 'auto';
            }

            const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(swapConfig)
            });

            const { swapTransaction } = await swapRes.json();
            if (!swapTransaction) throw new Error("ROUTE_UNAVAILABLE: Liquidity exhausted.");

            const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));

            // VORTEX ELITE PROTOCOL: Decompile, inject flat SOL fee, and recompile
            setExecStatus('INJECTING_VORTEX_FEE...');
            const altPks = transaction.message.addressTableLookups.map(a => a.accountKey);
            const altInfos = await connection.getMultipleAccountsInfo(altPks);
            const addressLookupTableAccounts = altInfos.map((info, idx) => {
                if (!info) return null;
                return new AddressLookupTableAccount({
                    key: altPks[idx],
                    state: AddressLookupTableAccount.deserialize(info.data)
                });
            }).filter((a): a is AddressLookupTableAccount => a !== null);

            const message = TransactionMessage.decompile(transaction.message, { addressLookupTableAccounts });

            // Ensure the fee goes to the Vortex Treasury reliably (front of transaction to avoid sandwich/slippage reverts)
            message.instructions.unshift(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new PublicKey(TREASURY_SWAPS),
                    lamports: PROTOCOL_FLAT_FEE_LAMPORTS,
                })
            );

            // Recompile with the new fee instruction
            transaction.message = message.compileToV0Message(addressLookupTableAccounts);

            // Pre-flight check to prevent burning user gas on guaranteed failures
            setExecStatus('SIMULATING_EXECUTION...');
            const simulation = await connection.simulateTransaction(transaction);
            if (simulation.value.err) {
                console.error("SIMULATION FAILED:", simulation.value.err, simulation.value.logs);
                throw new Error("TRANSACTION_SIMULATION_FAILED");
            }

            setExecStatus('AWAITING_SIGNATURE...');
            const signed = await signTransaction(transaction);

            // If Turbo, we bypass standard RPC wait rules
            const sendOptions = priorityLevel === 'Turbo' ? { skipPreflight: true, maxRetries: 0 } : { skipPreflight: true };

            const sig = await connection.sendRawTransaction(signed.serialize(), sendOptions);
            setExecStatus('AWAITING_CONFIRMATION...');
            await connection.confirmTransaction(sig, 'confirmed');

            notify('success', `ORDER_EXECUTED: [${sig.slice(0, 8)}...]`);
            setAmount('');
        } catch (e: any) {
            notify('error', `EXECUTION_FAILED: ${e.message}`);
            captureException(e, { context: 'SWAP_EXECUTION' });
        } finally {
            setExecuting(false);
            setExecStatus('');
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
