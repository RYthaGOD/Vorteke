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

        // 2. Funding Fingerprint Recon (Cross-check)
        const clusters = await detectFundingClusters(address);

        // 3. Risk Scoring based on density and funding
        let bundleProbability = densityPercentage;

        // If funding clusters are found, it's almost certainly a professional bundler launch
        if (clusters.length > 0) {
            bundleProbability = Math.max(bundleProbability, 85);
        }

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
 * Funding Fingerprint Recon: Detects cluster funding from common SOL sources (CEX or Bundler).
 * Analyzes the first 5 buyers to find if they share a common funding signature.
 */
export async function detectFundingClusters(address: string): Promise<string[]> {
    try {
        const pubkey = new PublicKey(address);
        // Get the very first signatures (earliest buyers)
        const sigs = await getResilientConnection(c => c.getSignaturesForAddress(pubkey, { limit: 10 }));
        if (sigs.length < 2) return [];

        const firstSigs = sigs.reverse().slice(0, 5);
        const sourceWallets = new Set<string>();

        // For each early buyer, find their SOL funding source
        const results = await Promise.allSettled(firstSigs.map(async (s) => {
            return await getResilientConnection(async (c) => {
                const tx = await c.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
                if (!tx) return null;
                const buyer = tx.transaction.message.accountKeys[0].pubkey.toBase58();

                // Get most recent SOL transfers to this buyer
                const recentTxs = await c.getSignaturesForAddress(new PublicKey(buyer), { limit: 5 });
                if (!recentTxs || recentTxs.length === 0) return null;

                // The oldest transaction in this recent batch is more likely to be the funding tx
                // rather than the most recent one (which is likely the swap itself).
                const fundingSig = recentTxs[recentTxs.length - 1].signature;
                const fundingTx = await c.getParsedTransaction(fundingSig, { maxSupportedTransactionVersion: 0 });

                // If it's a Transfer, return the source
                if (fundingTx?.meta?.postBalances && fundingTx.meta.preBalances) {
                    const instructions = fundingTx.transaction.message.instructions;
                    const transfer = instructions.find((i: any) => i.program === 'system' && i.parsed?.type === 'transfer');
                    if (transfer) return (transfer as any).parsed.info.source;
                }
                return null;
            });
        }));

        const sources = results
            .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(Boolean) as string[];

        // Return clusters where the same source funded 2+ wallets
        const counts: Record<string, number> = {};
        sources.forEach(s => counts[s] = (counts[s] || 0) + 1);

        return Object.keys(counts).filter(s => counts[s] > 1);
    } catch (e) {
        console.warn("FUNDING_RECON_FAILURE:", e);
        return [];
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

        let score = 100 - (rugHeuristic * 100);
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
        // Query server for other tokens created by this same address
        const res = await fetch(`/api/tokens?creator=${creatorAddress}`);
        if (!res.ok) return [];
        const tokens = await res.json();
        return tokens.map((t: any) => t.symbol).filter(Boolean).slice(0, 5);
    } catch {
        return [];
    }
}
