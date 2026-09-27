import { TokenTier } from '../../monetizationService';

export interface TokenInfo {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
    priceUsd: number;
    priceChange24h: number;
    volume24h: number;
    liquidityUsd: number;
    fdv: number;
    mcap: number;
    holders: number;
    owner?: string;
    tier?: TokenTier;
    latency?: number;
    socials?: {
        twitter?: string;
        telegram?: string;
        website?: string;
    };
    customDescription?: string;
    bannerURI?: string;
    iconURI?: string;
    advancedMetrics: {
        top10HolderPercent: number;
        devWalletStatus: 'selling' | 'holding' | 'accumulating' | 'burnt';
        lpBurnStatus: 'verified' | 'unverified' | 'locked';
        slippage1k: number;
        slippage10k: number;
        snipeVolumePercent: number;
        mintAuthority: 'renounced' | 'active';
        freezeAuthority: 'renounced' | 'active';
        metadataMutable: boolean;
        transferFeeBps?: number;
        holderIntelligence?: {
            clusterDetected: boolean;
            clusterSize: number;
            riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
            top10Percent: number;
        };
        marketVelocity?: {
            score: number;
            activityLevel: 'DORMANT' | 'TRENDING' | 'VOLATILE';
        };
        volumeVelocity?: {
            score: number; // 0-100
            status: 'STAGNANT' | 'STABLE' | 'ACCELERATING' | 'BREAKOUT';
            ratio: number;
        };
        velocitySentiment?: {
            buyPercent: number;
            sellPercent: number;
        };
        cluster?: string[];
        fundingSource?: {
            source: string;
            type: string;
        } | null;
    };
    securityTags?: string[];
    isSafe?: boolean;
    tags?: string[];
    isPumpFun?: boolean;
    velocityScore?: number;
    velocityStatus?: 'STAGNANT' | 'STABLE' | 'ACCELERATING' | 'BREAKOUT';
    resolvedEndpoint?: string;
}
