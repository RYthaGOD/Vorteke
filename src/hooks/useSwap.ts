import { useState, useEffect, useRef } from 'react';
import { Connection, LAMPORTS_PER_SOL, PublicKey, VersionedTransaction, TransactionMessage, AddressLookupTableAccount, SystemProgram } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TokenInfo, throttledFetch } from '@/lib/dataService';
import { SOL_MINT, TREASURY_SWAPS, PROTOCOL_FLAT_FEE_LAMPORTS, JITO_TIP_ACCOUNTS, JITO_DEFAULT_TIP_LAMPORTS } from '@/lib/constants';
import { captureException } from '@/lib/logger';

interface DflowQuote {
    inputMint: string;
    outputMint: string;
    inputAmount: string;
    outputAmount: string;
    priceImpact: string;
    route: any;
}

/**
 * Hook for managing SOL and Token balances.
 */
export function useSwapBalances(token: TokenInfo) {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number | null>(null);
    const [tokenBalance, setTokenBalance] = useState<number | null>(null);

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
                    setTokenBalance(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount);
                } else {
                    setTokenBalance(0);
                }
            } catch (e) {
                console.error("BALANCE_ERROR:", e);
            }
        };

        fetchBalances();
        const id = setInterval(fetchBalances, 10000);
        return () => clearInterval(id);
    }, [publicKey, token.address, connection]);

    return { balance, tokenBalance };
}

/**
 * Hook for Jupiter V6 Quote resolution.
 */
/**
 * Hook for Jupiter V6 Quote resolution.
 */
export function useSwapQuote(
    token: TokenInfo,
    amount: string,
    slippage: string,
    swapMode: 'BUY' | 'SELL'
) {
    const [quote, setQuote] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const inputMint = swapMode === 'BUY' ? SOL_MINT : token.address;
    const outputMint = swapMode === 'BUY' ? token.address : SOL_MINT;
    const inputDecimals = swapMode === 'BUY' ? 9 : token.decimals;
    const outputDecimals = swapMode === 'BUY' ? token.decimals : 9;

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
                const slippageBps = slippage === 'Auto' ? 100 : parseFloat(slippage) * 100;

                const query = new URLSearchParams({
                    inputMint,
                    outputMint,
                    amount: inputAmount.toString(),
                    slippageBps: slippageBps.toString()
                });

                const quoteResponse = await fetch(`/api/proxy/jup-quote?${query.toString()}`, {
                    signal: abortController.signal
                });

                if (!quoteResponse.ok) throw new Error('JUPITER_OFFLINE');
                const data = await quoteResponse.json();

                if (data.outAmount) {
                    const jupQuote = {
                        outAmount: parseFloat(data.outAmount) / Math.pow(10, outputDecimals),
                        priceImpact: parseFloat(data.priceImpactPct) || 0,
                        feeBps: 10,
                        raw: data
                    };

                    if (!abortController.signal.aborted) {
                        setQuote(jupQuote);
                    }
                }
            } catch (e: any) {
                if (e.name !== 'AbortError') console.error("QUOTE_ERROR:", e);
            } finally {
                if (!abortController.signal.aborted) setLoading(false);
            }
        };

        const timer = setTimeout(fetchQuote, 500);
        return () => {
            clearTimeout(timer);
            abortController.abort();
        };
    }, [amount, token.address, slippage, swapMode, inputMint, outputMint, inputDecimals, outputDecimals]);

    return { quote, loading };
}

/**
 * Hook for managing transaction execution flow.
 */
export function useSwapExecution(
    token: TokenInfo,
    notify: (type: 'success' | 'error' | 'info', msg: string) => void,
    isElite: boolean = false
) {
    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();
    const [executing, setExecuting] = useState(false);
    const [execStatus, setExecStatus] = useState('');

    const executeSwap = async (
        amount: string,
        swapMode: 'BUY' | 'SELL',
        quote: any,
        slippage: string,
        priorityLevel: 'Normal' | 'Turbo'
    ) => {
        if (!publicKey || !signTransaction || !quote) return;

        setExecuting(true);
        setExecStatus('INITIALIZING...');

        try {
            const swapConfig: any = {
                quoteResponse: quote.raw,
                userPublicKey: publicKey.toString(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
            };

            if (priorityLevel === 'Turbo') {
                setExecStatus('ROUTING_TURBO...');
                swapConfig.prioritizationFeeLamports = 2500000;
            } else {
                swapConfig.prioritizationFeeLamports = 'auto';
            }

            const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(swapConfig)
            });

            const { swapTransaction } = await swapRes.json();
            if (!swapTransaction) throw new Error("ROUTE_UNAVAILABLE");

            const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));

            setExecStatus('VORTEX_PROTOCOL_INJECTION...');
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

            if (!isElite) {
                message.instructions.unshift(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: new PublicKey(TREASURY_SWAPS),
                        lamports: PROTOCOL_FLAT_FEE_LAMPORTS,
                    })
                );
            }

            if (priorityLevel === 'Turbo') {
                const jitoTipAccount = JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
                message.instructions.push(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: new PublicKey(jitoTipAccount),
                        lamports: JITO_DEFAULT_TIP_LAMPORTS,
                    })
                );
            }

            transaction.message = message.compileToV0Message(addressLookupTableAccounts);

            setExecStatus('SIMULATING...');
            const simulation = await connection.simulateTransaction(transaction);
            if (simulation.value.err) throw new Error("SIMULATION_FAILED");

            setExecStatus('SIGNING...');
            const signed = await signTransaction(transaction);

            const sendOptions = priorityLevel === 'Turbo' ? { skipPreflight: true, maxRetries: 0 } : { skipPreflight: true };
            const sig = await connection.sendRawTransaction(signed.serialize(), sendOptions);

            setExecStatus('CONFIRMING...');
            await connection.confirmTransaction(sig, 'confirmed');

            notify('success', `ORDER_EXECUTED: [${sig.slice(0, 8)}...]`);
            return true;
        } catch (e: any) {
            notify('error', `EXECUTION_FAILED: ${e.message}`);
            captureException(e, { context: 'SWAP_HOOK' });
            return false;
        } finally {
            setExecuting(false);
            setExecStatus('');
        }
    };

    return { executeSwap, executing, execStatus, isElite };
}
