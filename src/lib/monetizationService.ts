import { Connection, PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { RPC_ENDPOINTS, PROTECTED_MINT_ADDRESSES, TREASURY_ENHANCEMENTS, TIER_PRICES_SOL } from './constants';
import { getResilientConnection } from './solana/connection';

export type TokenTier = 'Basic' | 'Enhanced' | 'Elite' | 'DeepScan';

export interface TokenEnhancement {
    address: string;
    tier: TokenTier;
    owner?: string; // Wallet address of the verified dev
    socials?: {
        twitter?: string;
        telegram?: string;
        website?: string;
    };
    customDescription?: string;
    bannerURI?: string;
    iconURI?: string;
}

// In production, these are defined by the treasury environment or VORTEX DAO
const ELITE_COLLECTION_MINT = process.env.NEXT_PUBLIC_ELITE_NFT_COLLECTION || 'EliteNFT_Collection_Address_Placeholder';
const VORTEX_ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_PUBKEY || TREASURY_ENHANCEMENTS;

const getStoredEnhancements = (): Record<string, TokenEnhancement> => {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem('vortex_enhancements');
    return stored ? JSON.parse(stored) : {};
};

const saveEnhancements = (data: Record<string, TokenEnhancement>) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('vortex_enhancements', JSON.stringify(data));
};

// Default system enhancements
// No hardcoded profiles: a paid tier badge must come from a real payment record.
const DEFAULT_ENHANCEMENTS: Record<string, TokenEnhancement> = {};

/**
 * Validates if a wallet holds the Elite VORTEX access.
 * In Mainnet, this checks for the Elite Pass NFT or Token.
 */
export const verifyEliteAccess = async (walletAddress: string): Promise<boolean> => {
    try {
        if (!walletAddress) return false;
        const pubkey = new PublicKey(walletAddress);

        // 1. Check for temporary internal access (Test/Promo bypass)
        try {
            const eliteResp = await fetch(`/api/auth/elite-check?wallet=${walletAddress}`);
            if (eliteResp.ok) {
                const eliteData = await eliteResp.json();
                if (eliteData.isElite) return true;
            }
        } catch (e) {
            console.warn("INTERNAL_ELITE_CHECK_FAILED, falling back to on-chain...");
        }

        // 2. FIX: Use getResilientConnection instead of bare new Connection()
        const tokens = await getResilientConnection(c =>
            c.getParsedTokenAccountsByOwner(pubkey, {
                programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
            })
        );

        const hasPass = tokens.value.some(t => {
            const info = t.account.data.parsed.info;
            return (info.mint === ELITE_COLLECTION_MINT && info.tokenAmount.uiAmount > 0);
        });

        // 3. Admin override or legacy bypass
        return hasPass || walletAddress === VORTEX_ADMIN_KEY;
    } catch (e) {
        console.error("ELITE_VERIFICATION_FAILURE:", e);
        return false;
    }
};

// FIX: Bounded LRU cache — max 100 entries to prevent unbounded memory growth
const ENHANCEMENT_CACHE_MAX = 100;
const enhancementCache = new Map<string, { data: TokenEnhancement, timestamp: number }>();

/**
 * Fetches token enhancement data from the backend with a 1-minute tactical cache.
 */
export const fetchTokenEnhancement = async (address: string): Promise<TokenEnhancement> => {
    const cached = enhancementCache.get(address);
    if (cached && (Date.now() - cached.timestamp < 60000)) {
        return cached.data;
    }

    try {
        const res = await fetch(`/api/enhancement/${address}`);
        if (!res.ok) throw new Error("FETCH_ENHANCEMENT_FAILED");
        const data = await res.json();

        const result = data || DEFAULT_ENHANCEMENTS[address] || { address, tier: 'Basic' as TokenTier };

        // Enforce cache size cap: evict oldest entry if over limit
        if (enhancementCache.size >= ENHANCEMENT_CACHE_MAX) {
            const oldestKey = enhancementCache.keys().next().value;
            if (oldestKey) enhancementCache.delete(oldestKey);
        }
        enhancementCache.set(address, { data: result, timestamp: Date.now() });
        return result;
    } catch (e) {
        return DEFAULT_ENHANCEMENTS[address] || { address, tier: 'Basic' as TokenTier };
    }
};

export const purchaseEnhancement = async (address: string, tier: TokenTier, wallet: string): Promise<string | null> => {
    try {
        const solPrice = TIER_PRICES_SOL[tier] ?? TIER_PRICES_SOL.Enhanced;
        const amountLamports = Math.floor(solPrice * 1_000_000_000);

        const resp = await fetch('/api/pay/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet, amount: amountLamports, address, tier })
        });

        if (!resp.ok) throw new Error((await resp.json()).error || "PAYMENT_INIT_FAILED");
        const { transaction } = await resp.json();
        return transaction;
    } catch (e: any) {
        console.error("PURCHASE FAILURE:", e);
        throw e;
    }
};

export const purchaseDeepScan = async (address: string, wallet: string): Promise<string | null> => {
    try {
        const isElite = await verifyEliteAccess(wallet);
        if (isElite) return 'ELITE_BYPASS';

        const scanFeeLamports = Math.floor(TIER_PRICES_SOL.DeepScan * 1_000_000_000);

        const resp = await fetch('/api/pay/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet, amount: scanFeeLamports, address, tier: 'DeepScan' })
        });

        if (!resp.ok) throw new Error("PAYMENT_INIT_FAILED");
        const { transaction } = await resp.json();
        return transaction;
    } catch (e: any) {
        console.error("PURCHASE DEEP SCAN FAILURE:", e);
        return null;
    }
};

export const verifyPayment = async (signature: string, address: string, tier: TokenTier, wallet: string): Promise<boolean> => {
    try {
        const res = await fetch('/api/pay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature, address, tier, wallet })
        });
        if (res.ok) enhancementCache.delete(address);
        return res.ok;
    } catch {
        return false;
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
        return res.ok;
    } catch {
        return false;
    }
};
