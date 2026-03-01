import { Connection, PublicKey } from '@solana/web3.js';
// @ts-ignore
import nacl from 'tweetnacl';
import { RPC_ENDPOINTS, PROTECTED_MINT_ADDRESSES, TREASURY_ENHANCEMENTS } from './constants';

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
const DEFAULT_ENHANCEMENTS: Record<string, TokenEnhancement> = {
    'JUPyiwrYPRnK3B9kR4A9p7YQ8vLwK2qNCjY7MkW99Ld': {
        address: 'JUPyiwrYPRnK3B9kR4A9p7YQ8vLwK2qNCjY7MkW99Ld',
        tier: 'Elite',
        socials: { twitter: 'https://x.com/JupiterExchange', website: 'https://jup.ag' },
        customDescription: 'The giant of Solana liquidity. Unified routing for every token.'
    }
};

/**
 * Validates if a wallet holds the Elite VORTEX access.
 * In Mainnet, this checks for the Elite Pass NFT or Token.
 */
export const verifyEliteAccess = async (walletAddress: string): Promise<boolean> => {
    try {
        if (!walletAddress) return false;
        const pubkey = new PublicKey(walletAddress);
        const endpoint = RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com';
        const conn = new Connection(endpoint, 'confirmed');

        // Check for specific SPL Token holding (VORTEX Pass)
        const tokens = await conn.getParsedTokenAccountsByOwner(pubkey, {
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        });

        const hasPass = tokens.value.some(t => {
            const info = t.account.data.parsed.info;
            return (info.mint === ELITE_COLLECTION_MINT && info.tokenAmount.uiAmount > 0);
        });

        // For development/demo, we also allow admin override or specific dev wallets
        return hasPass || walletAddress === VORTEX_ADMIN_KEY;
    } catch (e) {
        console.error("ELITE_VERIFICATION_FAILURE:", e);
        return false;
    }
};

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
        enhancementCache.set(address, { data: result, timestamp: Date.now() });
        return result;
    } catch (e) {
        return DEFAULT_ENHANCEMENTS[address] || { address, tier: 'Basic' as TokenTier };
    }
};

export const purchaseEnhancement = async (address: string, tier: TokenTier, wallet: string): Promise<string | null> => {
    // Silent in production

    try {
        const usdcAmount = tier === 'Elite' ? 120 : 30; // 30 USDC or 120 USDC

        // Fetch live SOL equivalent from Jupiter (USDC to SOL)
        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const solMint = 'So11111111111111111111111111111111111111112';
        const usdcLamports = usdcAmount * 1_000_000; // USDC has 6 decimals

        const jupQuoteRes = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${usdcMint}&outputMint=${solMint}&amount=${usdcLamports}&slippageBps=50`);
        const jupQuote = await jupQuoteRes.json();

        if (!jupQuote.outAmount) throw new Error("JUPITER_QUOTE_FAILED");

        // Convert outAmount (Lamports) to SOL for the backend
        const dynamicSolAmount = Number(jupQuote.outAmount) / 1_000_000_000; // SOL has 9 decimals

        // Dynamic pricing computed

        const resp = await fetch('/api/pay/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet, amount: dynamicSolAmount, address, tier })
        });

        if (!resp.ok) throw new Error("PAYMENT_INIT_FAILED");
        const { transaction } = await resp.json();
        return transaction;
    } catch (e: any) {
        console.error("PURCHASE FAILURE:", e);
        return null;
    }
};

export const purchaseDeepScan = async (address: string, wallet: string): Promise<string | null> => {
    // Deep scan initiated
    try {
        // 1. Check if the user is an Elite Pass Holder
        const isElite = await verifyEliteAccess(wallet);
        if (isElite) {
            // Elite bypass
            return 'ELITE_BYPASS';
        }

        const scanFeeSol = 0.02; // Flat 0.02 SOL for Deep Scan

        const resp = await fetch('/api/pay/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet, amount: scanFeeSol, address, tier: 'DeepScan' })
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
        return res.ok;
    } catch {
        return false;
    }
};

export const claimProject = async (address: string, wallet: string, signature: string, timestamp: number): Promise<boolean> => {
    // Claim process

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
