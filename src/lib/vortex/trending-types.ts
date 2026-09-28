export interface TrendingToken {
    address: string;
    poolAddress: string;
    symbol: string;
    name: string;
    logoURI: string | null;
    priceUsd: number;
    priceChange30m: number;
    volume30m: number;
    prices: number[];
}
export interface TrendingResponse {
    tokens: TrendingToken[];
    windowEnd: number;
    generatedAt: number;
    candidateCount: number;
    unavailableCount: number;
}
