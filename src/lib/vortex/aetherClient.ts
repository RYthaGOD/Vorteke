import axios from 'axios';

const AETHER_API_URL = process.env.NEXT_PUBLIC_AETHER_API_URL || 'http://localhost:4000/graphql';

export interface Ohlcv {
    window_start: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface Swap {
    signature: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    amountOut: number;
    priceUsd: number;
    dex: string;
}

export interface TopMover {
    tokenAddress: string;
    current_price: number;
    pct_change: number;
}

export interface VolumeCluster {
    tokenAddress: string;
    total_volume: number;
    trade_count: number;
}

class AetherClient {
    private async query(query: string, variables: any = {}) {
        try {
            const response = await axios.post(AETHER_API_URL, {
                query,
                variables
            }, { timeout: 8000 });
            return response.data;
        } catch (error) {
            console.error('AETHER_QUERY_FAILURE:', error);
            return { data: null, errors: [error] };
        }
    }

    async getHistory(tokenAddress: string, interval: string = '1 minute'): Promise<Ohlcv[]> {
        const query = `
            query GetHistory($tokenAddress: String!, $interval: String!) {
                getHistory(tokenAddress: $tokenAddress, interval: $interval) {
                    window_start
                    open
                    high
                    low
                    close
                    volume
                }
            }
        `;
        const res = await this.query(query, { tokenAddress, interval });
        return res?.data?.getHistory || [];
    }

    async getTopMovers(): Promise<TopMover[]> {
        const query = `
            query GetTopMovers {
                getTopMovers {
                    tokenAddress
                    current_price
                    pct_change
                }
            }
        `;
        const res = await this.query(query);
        return res?.data?.getTopMovers || [];
    }

    async getVolumeClusters(): Promise<VolumeCluster[]> {
        const query = `
            query GetVolumeClusters {
                getVolumeClusters {
                    tokenAddress
                    total_volume
                    trade_count
                }
            }
        `;
        const res = await this.query(query);
        return res?.data?.getVolumeClusters || [];
    }

    async searchTokens(queryStr: string) {
        const query = `
            query SearchTokens($query: String!) {
                searchTokens(query: $query) {
                    mint
                    symbol
                    name
                    decimals
                }
            }
        `;
        const res = await this.query(query, { query: queryStr });
        return res?.data?.searchTokens || [];
    }

    async triggerIndexing(tokenAddress: string): Promise<boolean> {
        const query = `
            mutation TriggerIndexing($tokenAddress: String!) {
                triggerIndexing(tokenAddress: $tokenAddress)
            }
        `;
        const res = await this.query(query, { tokenAddress });
        return !!res?.data?.triggerIndexing;
    }
}

export const aetherClient = new AetherClient();
