import { useState, useEffect } from 'react';
import { LAMPORTS_PER_SOL, PublicKey, VersionedTransaction, AddressLookupTableAccount } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TokenInfo } from '@/lib/dataService';
import { SOL_MINT, TREASURY_SWAPS, PROTOCOL_FLAT_FEE_LAMPORTS, JITO_DEFAULT_TIP_LAMPORTS, randomTipAccount } from '@/lib/constants';
import bs58 from 'bs58';
import { prepareSwapTransaction } from '@/lib/solana/swapTransaction.mjs';
import { captureException } from '@/lib/logger';

const TURBO_GRACE_MS = 8000;

interface SwapQuote { outAmount: number; priceImpact: number; feeBps: number; raw: Record<string, unknown>; }

/**
 * Hook for managing SOL and Token balances.
 */
export function useSwapBalances(token: TokenInfo) {
    const { connection } = useConnection();
    const { publicKey, connected } = useWallet();
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
        // H6 FIX: include `connected` so the effect re-fires on disconnect, clearing the interval
    }, [publicKey, connected, token.address, connection]);

    return { balance, tokenBalance };
}

/**
 * Hook for Jupiter V6 Quote resolution.
 */
/**
 * Hook for Jupiter V6 Quote resolution.
 */
export function useSwapQuote(token: TokenInfo, amount: string, slippage: string, swapMode: 'BUY' | 'SELL') {
    const inputMint = swapMode === 'BUY' ? SOL_MINT : token.address;
    const outputMint = swapMode === 'BUY' ? token.address : SOL_MINT;
    const inputDecimals = swapMode === 'BUY' ? 9 : token.decimals;
    const outputDecimals = swapMode === 'BUY' ? token.decimals : 9;
    const key = [inputMint, outputMint, amount, slippage, inputDecimals, outputDecimals].join(':');
    const [result, setResult] = useState<{ key: string; quote: SwapQuote | null; error: string | null } | null>(null);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        const value = Number(amount);
        const inputAmount = Math.floor(value * 10 ** inputDecimals);
        const slippageBps = slippage === 'Auto' ? 100 : Math.round(Number(slippage) * 100);
        if (!amount || !Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(inputAmount) || inputAmount <= 0 || !slippage.trim() || !Number.isFinite(slippageBps) || slippageBps < 0 || slippageBps > 5000 || inputMint === outputMint) {
            setPendingKey(null);
            setResult({ key, quote: null, error: amount && value > 0 ? 'Check the amount and slippage. Choose a different token to swap SOL.' : null });
            return;
        }
        setPendingKey(key);
        // Background refreshes keep the last quote on screen; only a new key clears it.
        const fetchQuote = async () => {
            setPendingKey(key);
            try {
                const query = new URLSearchParams({ inputMint, outputMint, amount: String(inputAmount), slippageBps: String(slippageBps) });
                const response = await fetch('/api/proxy/jup-quote?' + query, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
                if (!response.ok) throw new Error('Quote unavailable');
                const data = await response.json();
                const output = Number(data.outAmount) / 10 ** outputDecimals;
                if (!Number.isFinite(output) || output <= 0) throw new Error('No route available');
                if (!controller.signal.aborted) setResult({ key, error: null, quote: { outAmount: output, priceImpact: Number(data.priceImpactPct) || 0, feeBps: 10, raw: data } });
            } catch {
                if (!controller.signal.aborted) setResult({ key, quote: null, error: 'No quote available. Check the amount or try again shortly.' });
            } finally {
                if (!controller.signal.aborted) setPendingKey(null);
            }
        };
        const timer = setTimeout(fetchQuote, 250);
        const refresh = setInterval(fetchQuote, 15000);
        return () => { clearTimeout(timer); clearInterval(refresh); controller.abort(); };
    }, [key, amount, slippage, inputMint, outputMint, inputDecimals, outputDecimals]);
    const current = result?.key === key ? result : null;
    return { quote: current?.quote ?? null, error: current?.error ?? null, loading: pendingKey === key && !current };
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

    const appeared = async (signature: string, ms: number) => {
        const deadline = Date.now() + ms;
        while (Date.now() < deadline) {
            const { value } = await connection.getSignatureStatuses([signature]);
            if (value[0]) return true;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return false;
    };

    const executeSwap = async (
        amount: string,
        swapMode: 'BUY' | 'SELL',
        quote: SwapQuote | null,
        slippage: string,
        priorityLevel: 'Normal' | 'Turbo'
    ) => {
        if (!publicKey || !signTransaction || !quote) return;

        setExecuting(true);
        setExecStatus('Preparing swap…');

        try {
            const swapConfig: any = {
                quoteResponse: quote.raw,
                userPublicKey: publicKey.toString(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
            };

            if (priorityLevel === 'Turbo') {
                setExecStatus('Routing through Turbo…');
                swapConfig.prioritizationFeeLamports = 2500000;
            } else {
                swapConfig.prioritizationFeeLamports = 'auto';
            }

            const swapRes = await fetch('/api/proxy/jup-swap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(swapConfig)
            });

            if (!swapRes.ok) throw new Error('Could not prepare the swap. Refresh the quote and retry.');
            const { swapTransaction, lastValidBlockHeight } = await swapRes.json();
            if (!swapTransaction) throw new Error('No route is available for this swap right now.');

            let transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));

            setExecStatus('Building transaction…');
            const altPks = transaction.message.addressTableLookups.map(a => a.accountKey);
            const altInfos = await connection.getMultipleAccountsInfo(altPks);
            const addressLookupTableAccounts = altInfos.map((info, idx) => {
                if (!info) return null;
                return new AddressLookupTableAccount({
                    key: altPks[idx],
                    state: AddressLookupTableAccount.deserialize(info.data)
                });
            }).filter((a): a is AddressLookupTableAccount => a !== null);

            transaction = prepareSwapTransaction(transaction, publicKey, addressLookupTableAccounts, {
                treasury: TREASURY_SWAPS,
                feeLamports: isElite ? 0 : PROTOCOL_FLAT_FEE_LAMPORTS,
                tip: priorityLevel === 'Turbo' ? { address: randomTipAccount(), lamports: JITO_DEFAULT_TIP_LAMPORTS } : undefined,
            });

            setExecStatus('Checking the transaction…');
            const simulation = await connection.simulateTransaction(transaction);
            if (simulation.value.err) throw new Error('The swap would fail on-chain. Refresh the quote or raise slippage.');

            setExecStatus('Waiting for your wallet…');
            const signed = await signTransaction(transaction);
            const serialized = Buffer.from(signed.serialize()).toString('base64');

            let sig = '';
            if (priorityLevel === 'Turbo') {
                setExecStatus('Sending through Turbo…');
                try {
                    const jitoRes = await fetch('/api/proxy/jito-bundle', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ signedTransaction: serialized })
                    });

                    if (!jitoRes.ok) throw new Error("JITO_BUNDLE_REJECTED");
                    const jitoData = await jitoRes.json();

                    if (jitoData.error || !jitoData.result) throw new Error('JITO_SUBMISSION_FAILED');
                    // sendBundle returns a bundle ID, not a transaction signature.
                    sig = bs58.encode(signed.signatures[0]);
                    // A bundle can be accepted and still dropped. Resend the same signed transaction
                    // through RPC if it hasn't appeared; the shared signature means it can only land once.
                    if (!(await appeared(sig, TURBO_GRACE_MS))) {
                        setExecStatus('Turbo is slow, sending normally…');
                        await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
                    }
                } catch (jitoErr: any) {
                    console.error("JITO_FAIL_FALLBACK", jitoErr);
                    // Fallback to standard transmission if Jito fails, so user doesn't lose the trade
                    sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
                }
            } else {
                setExecStatus('Sending…');
                sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
            }

            setExecStatus('Confirming…');
            const confirmation = Number.isInteger(lastValidBlockHeight)
                ? await connection.confirmTransaction({ signature: sig, blockhash: signed.message.recentBlockhash, lastValidBlockHeight }, 'confirmed')
                : await connection.confirmTransaction(sig, 'confirmed');
            if (confirmation.value.err) throw new Error('The transaction was confirmed with an error. No swap completed.');

            notify('success', `Swap confirmed (${sig.slice(0, 8)}…).`);
            return true;
        } catch (e: any) {
            notify('error', `Swap failed: ${e.message}`);
            captureException(e, { context: 'SWAP_HOOK' });
            return false;
        } finally {
            setExecuting(false);
            setExecStatus('');
        }
    };

    return { executeSwap, executing, execStatus, isElite };
}
