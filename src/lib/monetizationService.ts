import { PublicKey } from '@solana/web3.js';
import { TREASURY_ENHANCEMENTS } from './constants';
import { getResilientConnection } from './solana/connection';

export type TokenTier = 'Basic' | 'Enhanced';
export type Product = 'Enhanced' | 'Boost' | 'EliteAccess';

export interface TokenEnhancement {
    address: string;
    tier: TokenTier;
    owner?: string | null; // Wallet address of the verified dev
    boosted?: boolean;
    boostExpiresAt?: string | null;
    socials?: {
        twitter?: string;
        telegram?: string;
        website?: string;
    };
    customDescription?: string | null;
    bannerURI?: string | null;
    iconURI?: string | null;
}

export interface EliteStatus {
    isElite: boolean;
    expiresAt: string | null;
    source?: string;
}

// An optional Elite pass NFT, checked only when a collection mint is configured.
const ELITE_COLLECTION_MINT = process.env.NEXT_PUBLIC_ELITE_NFT_COLLECTION || '';
const VORTEX_ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_PUBKEY || TREASURY_ENHANCEMENTS;

/** Elite access for a wallet: a paid or granted EliteAccess record, the admin wallet, or the optional pass NFT. */
export const fetchEliteStatus = async (walletAddress: string): Promise<EliteStatus> => {
    try {
        if (!walletAddress) return { isElite: false, expiresAt: null };
        if (walletAddress === VORTEX_ADMIN_KEY) return { isElite: true, expiresAt: null, source: 'admin' };
        const response = await fetch(`/api/auth/elite-check?wallet=${walletAddress}`);
        if (response.ok) {
            const data = await response.json();
            if (data.isElite) return { isElite: true, expiresAt: data.expiresAt ?? null, source: data.source };
            if (!ELITE_COLLECTION_MINT) return { isElite: false, expiresAt: data.expiresAt ?? null };
        }
        if (!ELITE_COLLECTION_MINT) return { isElite: false, expiresAt: null };
        const tokens = await getResilientConnection(c =>
            c.getParsedTokenAccountsByOwner(new PublicKey(walletAddress), { mint: new PublicKey(ELITE_COLLECTION_MINT) })
        );
        const hasPass = tokens.value.some(t => t.account.data.parsed.info.tokenAmount.uiAmount > 0);
        return { isElite: hasPass, expiresAt: null, source: hasPass ? 'pass' : undefined };
    } catch (e) {
        console.error("ELITE_VERIFICATION_FAILURE:", e);
        return { isElite: false, expiresAt: null };
    }
};

export const verifyEliteAccess = async (walletAddress: string): Promise<boolean> => (await fetchEliteStatus(walletAddress)).isElite;

// FIX: Bounded LRU cache — max 100 entries to prevent unbounded memory growth
const ENHANCEMENT_CACHE_MAX = 100;
const enhancementCache = new Map<string, { data: TokenEnhancement, timestamp: number }>();

/**
 * Fetches the public profile for a token, cached for a minute.
 */
export const fetchTokenEnhancement = async (address: string): Promise<TokenEnhancement> => {
    const cached = enhancementCache.get(address);
    if (cached && (Date.now() - cached.timestamp < 60000)) {
        return cached.data;
    }

    try {
        const res = await fetch(`/api/enhancement/${address}`);
        if (!res.ok) throw new Error("FETCH_ENHANCEMENT_FAILED");
        const result: TokenEnhancement = (await res.json()) || { address, tier: 'Basic' };

        if (enhancementCache.size >= ENHANCEMENT_CACHE_MAX) {
            const oldestKey = enhancementCache.keys().next().value;
            if (oldestKey) enhancementCache.delete(oldestKey);
        }
        enhancementCache.set(address, { data: result, timestamp: Date.now() });
        return result;
    } catch (e) {
        return { address, tier: 'Basic' };
    }
};

/** Starts a payment. The server fixes the SOL amount from the USD price and returns an unsigned transaction. */
export const startPayment = async (address: string, product: Product, wallet: string): Promise<{ transaction: string; lamports: number; usdCents: number }> => {
    const resp = await fetch('/api/pay/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, address, tier: product })
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(body.error || "PAYMENT_INIT_FAILED");
    return body;
};

export const verifyPayment = async (signature: string, address: string, product: Product, wallet: string): Promise<{ success: true; expiresAt: string | null } | null> => {
    try {
        const res = await fetch('/api/pay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature, address, tier: product, wallet })
        });
        if (!res.ok) return null;
        enhancementCache.delete(address);
        const body = await res.json();
        return { success: true, expiresAt: body.expiresAt ?? null };
    } catch {
        return null;
    }
};

export const claimProject = async (address: string, wallet: string, signature: string, timestamp: number): Promise<boolean> => {
    try {
        const res = await fetch(`/api/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, wallet, signature, timestamp })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "CLAIM_FAILED");
        }

        enhancementCache.delete(address);
        return true;
    } catch (e: any) {
        console.error("CLAIM SERVICE FAILURE:", e);
        return false;
    }
};

export const updateProjectMetadata = async (address: string, wallet: string, signature: string, timestamp: number, metadata: Partial<TokenEnhancement>): Promise<boolean> => {
    try {
        const res = await fetch(`/api/claim`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, wallet, signature, timestamp, metadata })
        });
        if (res.ok) enhancementCache.delete(address);
        return res.ok;
    } catch {
        return false;
    }
};
