'use client';
import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

const key = (wallet: string) => 'vortex-elite-session:' + wallet;

function stored(wallet: string): string | null {
    try {
        const saved = JSON.parse(localStorage.getItem(key(wallet)) || 'null');
        return saved && typeof saved.token === 'string' && new Date(saved.expiresAt).getTime() > Date.now() + 60_000 ? saved.token : null;
    } catch { return null; }
}

/** A research token for the connected Elite wallet: reused while valid, otherwise one wallet signature. */
export function useEliteSession() {
    const { publicKey, signMessage } = useWallet();
    const wallet = publicKey?.toBase58();

    const getToken = useCallback(async (): Promise<string> => {
        if (!wallet || !signMessage) throw new Error('Connect your Elite wallet first.');
        const existing = stored(wallet);
        if (existing) return existing;
        const timestamp = Date.now();
        const signature = await signMessage(new TextEncoder().encode(`VORTEX_ELITE_SESSION:${wallet}:${timestamp}`));
        const response = await fetch('/api/elite/session', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet, signature: bs58.encode(signature), timestamp }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error === 'ELITE_REQUIRED' ? 'This wallet has no active Elite access.' : 'Sign-in failed. Try again.');
        try { localStorage.setItem(key(wallet), JSON.stringify(body)); } catch { /* storage unavailable */ }
        return body.token;
    }, [wallet, signMessage]);

    const clear = useCallback(() => { if (wallet) try { localStorage.removeItem(key(wallet)); } catch { /* ignore */ } }, [wallet]);
    return { getToken, clear };
}
