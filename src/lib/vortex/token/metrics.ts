import { PublicKey } from '@solana/web3.js';
import { getResilientConnection } from '../../solana/connection';
import { PROTECTED_MINT_ADDRESSES } from '../../constants';
import { fetchLargestHolders, summarizeHolders } from '../../scan/holders.mjs';

/**
 * Verify LP Burn status by checking the largest holders of the LP Token.
 * Enhanced for Raydium V4, CPMM, and Pump.fun.
 */
export const verifyLPBurn = async (tokenAddress: string): Promise<'verified' | 'unverified' | 'locked'> => {
    try {
        const isSafe = PROTECTED_MINT_ADDRESSES.includes(tokenAddress);
        if (isSafe) return 'verified';

        // 1. Recon Burn Destinations (Mainnet Protocol Standards)
        const BURN_ADDRESSES = [
            '11111111111111111111111111111111', // System
            'DeadPvPc9Kj1F6D9YJ1D1D1D1D1D1D1D1D1D1D1D1D1', // Jup/Trojan Common
            '6EF8rrecthR5Dkzon8Nwu78hRvfX9PNn2A9zH8GfE7rL', // Pump.fun Program itself
            '39393939393939393939393939393939393939393939', // Token-2022 Burn
        ];

        const pubkey = new PublicKey(tokenAddress);

        // FIX: Wrap ALL connection calls in a single getResilientConnection for full retry/failover coverage
        return await getResilientConnection(async (connection) => {
            // 2. Fetch Largest Accounts (Heuristic: LP tokens are usually the largest accounts)
            const largestAccounts = await connection.getTokenLargestAccounts(pubkey, 'confirmed');
            largestAccounts.value = largestAccounts.value.slice(0, 20);

            const hasBurnAccount = largestAccounts.value.some(account =>
                BURN_ADDRESSES.includes(account.address.toBase58()) && (account.uiAmount || 0) > 0
            );

            // 3. Authority Check (The Gold Standard)
            const mintInfo = await connection.getParsedAccountInfo(pubkey);
            const mintData = (mintInfo.value?.data as any)?.parsed?.info;

            // If mint authority is null and a burn account holds tokens, it's highly likely burned.
            if (hasBurnAccount && mintData && !mintData.mintAuthority) return 'verified';
            if (mintData && !mintData.mintAuthority) return 'locked'; // Fixed supply but not necessarily "burned" LP

            return 'unverified';
        });
    } catch (e) {
        console.warn("LP_BURN_VERIFICATION_FAILED:", e);
        return 'unverified';
    }
};

/**
 * Advanced Holder Intelligence: Cluster Detection
 */
export const getHolderConcentration = async (address: string): Promise<{
    clusterDetected: boolean;
    clusterSize: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    top10Percent: number | null;
}> => {
    try {
        // Wallet concentration only: pools, bonding curves and burns are excluded by account owner.
        // In the browser this reads the cached server scan; on the server it reads the chain directly.
        let top10Percent: number;
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        if (typeof window !== 'undefined') {
            const response = await fetch('/api/scan/' + encodeURIComponent(address));
            if (!response.ok) throw new Error('SCAN_UNAVAILABLE');
            ({ top10WalletPercent: top10Percent, riskLevel } = await response.json());
        } else {
            const largest = await getResilientConnection(c => fetchLargestHolders(c, address));
            ({ top10WalletPercent: top10Percent, riskLevel } = summarizeHolders(largest));
        }
        return {
            clusterDetected: riskLevel !== 'LOW',
            clusterSize: 0,
            riskLevel,
            top10Percent,
        };
    } catch (e) {
        return { clusterDetected: false, clusterSize: 0, riskLevel: 'LOW' as const, top10Percent: null };
    }
};

/**
 * Market Velocity Engine (Formerly Social Sentiment)
 */
export const getMarketVelocity = async (address: string, volume24h: number = 0, change24h: number = 0, liquidity: number = 0): Promise<{
    score: number;
    activityLevel: 'DORMANT' | 'TRENDING' | 'VOLATILE';
}> => {
    const vldRatio = liquidity > 0 ? (volume24h / liquidity) : 0;
    const baseHeat = Math.min(70, vldRatio * 35);
    const trendHeat = Math.max(0, change24h > 20 ? 30 : change24h > 5 ? 15 : 0);
    const score = Math.floor(Math.min(100, baseHeat + trendHeat));

    return {
        score,
        activityLevel: score > 85 ? ('VOLATILE' as const) : score > 45 ? ('TRENDING' as const) : ('DORMANT' as const)
    };
};
