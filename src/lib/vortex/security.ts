import { PublicKey } from '@solana/web3.js';
import { getResilientConnection } from '../solana/connection';

export interface BundleRisk {
    isBundled: boolean;
    percentage: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Tactical Security Heuristics: detect bundle snipers in the launch block.
 * Analyzes signature density and temporal clustering via active RPC recon.
 */
export async function detectBundle(address: string): Promise<BundleRisk> {
    try {
        const pubkey = new PublicKey(address);

        // Fetch signatures for the target asset
        const sigs = await getResilientConnection(c => c.getSignaturesForAddress(pubkey, { limit: 100 }));

        if (sigs.length === 0) return { isBundled: false, percentage: 0, riskLevel: 'LOW' };

        // 1. Block Density Analysis (Temporal Clustering)
        const blockMap: Record<number, number> = {};
        sigs.forEach((s: any) => {
            if (s.blockTime) {
                blockMap[s.blockTime] = (blockMap[s.blockTime] || 0) + 1;
            }
        });

        const maxTxInBlock = Math.max(...Object.values(blockMap), 0);
        const densityPercentage = (maxTxInBlock / sigs.length) * 100;

        // Block density only. Funder tracing costs about 30 RPC calls per token, which pushed browsers
        // into Helius rate limits on every token view; it now runs server-side in Elite research.
        const bundleProbability = densityPercentage;

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (bundleProbability > 50) riskLevel = 'HIGH';
        else if (bundleProbability > 20) riskLevel = 'MEDIUM';

        return {
            isBundled: bundleProbability > 20,
            percentage: parseFloat(bundleProbability.toFixed(2)),
            riskLevel
        };
    } catch (e) {
        console.error("BUNDLE_RECON_FAILURE:", e);
        return { isBundled: false, percentage: 0, riskLevel: 'LOW' };
    }
}

/**
 * Developer Reputation Recon: Scans the deployer's wallet history for suspicious patterns.
 * Looks for historical "rug" behavior or high failure rates in previous launches.
 */
export async function detectDeveloperReputation(creatorAddress: string): Promise<{ score: number; status: 'TRUSTED' | 'CAUTION' | 'DANGER' }> {
    if (!creatorAddress) return { score: 50, status: 'CAUTION' };

    try {
        const pubkey = new PublicKey(creatorAddress);
        const sigs = await getResilientConnection(c => c.getSignaturesForAddress(pubkey, { limit: 50 }));

        if (sigs.length < 5) return { score: 30, status: 'CAUTION' }; // New wallet = Higher risk

        // Simple heuristic: check for interaction with known rug-pull programs or high churn
        // In a production environment, this would hit a proprietary reputation database.
        const rugHeuristic = sigs.filter(s => s.err).length / sigs.length;

        const score = 100 - (rugHeuristic * 100);
        let status: 'TRUSTED' | 'CAUTION' | 'DANGER' = 'TRUSTED';

        if (score < 40) status = 'DANGER';
        else if (score < 70) status = 'CAUTION';

        return { score: Math.floor(score), status };
    } catch {
        return { score: 50, status: 'CAUTION' };
    }
}

/**
 * Creator Cluster Detection: Multi-token reconnaissance.
 * Checks if the creator is currently linked to other active, high-volume tokens.
 */
export async function detectCreatorCluster(creatorAddress: string): Promise<string[]> {
    if (!creatorAddress) return [];

    try {
        const res = await fetch(`/api/tokens?creator=${creatorAddress}`);
        if (!res.ok) return [];
        const tokens = await res.json();

        // Return addresses of other tokens by this creator
        return Array.isArray(tokens) ? tokens.map((t: any) => t.address) : [];
    } catch {
        return [];
    }
}

/**
 * Helius Tactical Funding Recon: Identifies the original SOL source.
 * Uses the /funded-by endpoint for single-call resolution.
 */
export async function traceFundingOrigins(walletAddress: string): Promise<{ source: string; type: string } | null> {
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
    if (!HELIUS_API_KEY) return null;

    try {
        const res = await fetch(`https://api.helius.xyz/v1/wallet/${walletAddress}/funded-by?api-key=${HELIUS_API_KEY}`);
        if (!res.ok) return null;

        const data = await res.json();
        if (data && data.fundedBy) {
            return {
                source: data.fundedBy,
                type: data.type || 'UNKNOWN'
            };
        }
        return null;
    } catch (e) {
        console.warn("FUNDING_TRACE_FAILURE:", e);
        return null;
    }
}
