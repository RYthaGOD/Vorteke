'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SOLANA_NETWORK } from '@/lib/constants';
import { Product, startPayment, verifyPayment } from '@/lib/monetizationService';
import { trackEvent } from '@/lib/analytics';

export interface ProductPrice { usdCents: number; label: string; lamports: number | null; hours?: number; days?: number }
export interface PayConfig { solUsd: number | null; treasury: string; products: Record<Product, ProductPrice> }

/** Current USD prices with an indicative SOL amount. */
export function usePrices() {
    return useQuery<PayConfig>({
        queryKey: ['pay-config'],
        queryFn: async () => {
            const response = await fetch('/api/pay/config');
            if (!response.ok) throw new Error('Prices unavailable');
            return response.json();
        },
        staleTime: 60_000, refetchInterval: 60_000,
    });
}

const ERRORS: Record<string, string> = {
    CLAIM_PROJECT_FIRST: 'Claim this profile with your project wallet before purchasing.',
    ALREADY_ENHANCED: 'This profile is already Enhanced.',
    PRICE_UNAVAILABLE: 'The SOL price feed is unavailable, so no amount could be set. Try again in a minute.',
    PAYMENT_UNAVAILABLE: 'Payments are temporarily unavailable. Nothing was charged.',
};

type Pending = { signature: string; product: Product; wallet: string };

/**
 * Pay for a product with a single SOL transfer, then confirm it on the server. A submitted
 * payment is remembered per wallet and address, so a reload never leads to paying twice.
 */
export function usePayment(address: string | undefined, onPaid: (product: Product, expiresAt: string | null) => void) {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const wallet = publicKey?.toBase58();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState<Pending | null>(null);
    const storageKey = 'vortex-payment:' + SOLANA_NETWORK + ':' + address + ':' + wallet;

    useEffect(() => {
        setPending(null);
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (saved && typeof saved.signature === 'string' && typeof saved.product === 'string' && saved.wallet === wallet) setPending(saved);
        } catch { /* Storage can be unavailable in private browsing. */ }
    }, [storageKey, wallet]);

    const remember = (value: Pending | null) => {
        setPending(value);
        try { if (value) localStorage.setItem(storageKey, JSON.stringify(value)); else localStorage.removeItem(storageKey); } catch { /* ignore */ }
    };

    // Verification needs a finalized transaction, which usually takes 15 to 30 seconds.
    const recheck = async (payment: Pending, attempts = 1): Promise<boolean> => {
        if (!address) return false;
        for (let attempt = 0; attempt < attempts; attempt++) {
            if (attempt) await new Promise(resolve => setTimeout(resolve, 5000));
            const result = await verifyPayment(payment.signature, address, payment.product, payment.wallet);
            if (result) {
                remember(null);
                setMessage('');
                trackEvent('paid', payment.signature);
                onPaid(payment.product, result.expiresAt);
                return true;
            }
        }
        setMessage('The payment is not confirmed yet. Recheck it before paying again. If the transaction failed, nothing was charged.');
        return false;
    };

    const purchase = async (product: Product) => {
        if (!wallet || !address || busy || pending) return;
        setBusy(true); setMessage('Preparing your payment…');
        trackEvent('payment_started');
        try {
            const { transaction: encoded } = await startPayment(address, product, wallet);
            const transaction = Transaction.from(Buffer.from(encoded, 'base64'));
            const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
            const payment = { signature, product, wallet };
            remember(payment);
            setMessage('Payment sent. Waiting for final confirmation…');
            await recheck(payment, 12);
        } catch (error) {
            const text = error instanceof Error ? error.message : '';
            setMessage(ERRORS[text] || text || 'Payment could not be completed.');
        } finally { setBusy(false); }
    };

    const recheckPending = async () => {
        if (!pending) return;
        setBusy(true);
        try { await recheck(pending); } finally { setBusy(false); }
    };

    return { wallet, busy, message, setMessage, pending, purchase, recheckPending };
}

export const formatSol = (lamports: number | null | undefined) => lamports ? (lamports / 1e9).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + ' SOL' : '';
