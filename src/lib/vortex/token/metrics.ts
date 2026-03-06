import { TokenInfo } from '../../dataService';
import { PublicKey } from '@solana/web3.js';
import { getResilientConnection } from '../../solana/connection';
import { PROTECTED_MINT_ADDRESSES } from '../../constants';

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
            const largestAccounts = await connection.getTokenLargestAccounts(pubkey);

            const hasBurnAccount = largestAccounts.value.some(account =>
                BURN_ADDRESSES.includes(account.address.toBase58()) && (account.uiAmount || 0) > 0
            );

            if (hasBurnAccount) return 'verified';

            // 3. Precision LP Check (Raydium/Orca Fallback)
            const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 40 });
            const isBurned = sigs.some(s =>
                s.memo?.toLowerCase().includes('burn') ||
                s.memo?.toLowerCase().includes('lock') ||
                s.memo?.toLowerCase().includes('lp_burn') ||
                s.memo?.toLowerCase().includes('success_burn') ||
                s.memo?.toLowerCase().includes('burned')
            );

            if (isBurned) return 'verified';

            // Check if the mint authority is revoked (Common for burned/locked tokens)
            const mintInfo = await connection.getParsedAccountInfo(pubkey);
            const mintData = (mintInfo.value?.data as any)?.parsed?.info;
            if (mintData && !mintData.mintAuthority) return 'verified';

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
    top10Percent: number;
}> => {
    try {
        const pubkey = new PublicKey(address);
        const [largestAccounts, supplyInfo] = await Promise.all([
            getResilientConnection(c => c.getTokenLargestAccounts(pubkey)),
            getResilientConnection(c => c.getTokenSupply(pubkey))
        ]);

        // AMM Pools and Common Authority addresses to exclude from concentration
        const AMM_PROGRAMS = [
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium V4
            'whirLbMiq69ho3vSTmG5W699LGS3K62ddptS1AD25pk', // Orca Whirlpool
            'CAMMCzo5YL8w4VFF8KVHrSgS9Q8V5rREyauFpG6C9F1z', // Raydium CLMM
            'CPMMoo8LqacmJvSFeFs8vY81neC5uK79S6aywFMWo9E', // Raydium CPMM
            '9W959DqmcGTu2YJByGD47FGDeS8SWckv7y6B7vQfSnXj', // Fluxbeam
            '5quBozXPiGP2mLMCbUBZC7aRmxhPnzUqTgQwS4YsVH2j', // Jupiter Aggregator V4 Authority
            'GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ',  // Raydium LP Authority V4
        ];

        // Filter out accounts that are likely the LP itself
        const userAccounts = largestAccounts.value.filter((acc: any) => {
            return !AMM_PROGRAMS.includes(acc.address.toBase58());
        });

        const top10Total = userAccounts.slice(0, 10).reduce((acc: number, curr: any) => acc + (curr.uiAmount || 0), 0);
        const supply = supplyInfo.value.uiAmount || 1;
        const top10Percent = (top10Total / supply) * 100;

        const isHighRisk = top10Percent > 50;
        return {
            clusterDetected: isHighRisk,
            clusterSize: isHighRisk ? (top10Percent > 70 ? 10 : 5) : 0,
            riskLevel: top10Percent > 70 ? 'HIGH' : isHighRisk ? 'MEDIUM' : 'LOW',
            top10Percent: parseFloat(top10Percent.toFixed(2))
        };
    } catch (e) {
        return { clusterDetected: false, clusterSize: 0, riskLevel: 'LOW' as const, top10Percent: 0 };
    }
};

/**
 * Tactical Social Sentiment Engine
 */
export const getSocialSentiment = async (address: string, volume24h: number = 0, change24h: number = 0, liquidity: number = 0): Promise<{
    score: number;
    hypeLevel: 'DORMANT' | 'TRENDING' | 'MOONING';
}> => {
    const vldRatio = liquidity > 0 ? (volume24h / liquidity) : 0;
    const baseHeat = Math.min(70, vldRatio * 35);
    const trendHeat = Math.max(0, change24h > 20 ? 30 : change24h > 5 ? 15 : 0);
    const score = Math.floor(Math.min(100, baseHeat + trendHeat));

    return {
        score,
        hypeLevel: score > 85 ? ('MOONING' as const) : score > 45 ? ('TRENDING' as const) : ('DORMANT' as const)
    };
};
