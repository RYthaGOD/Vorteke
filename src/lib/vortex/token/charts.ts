import { Connection } from '@solana/web3.js';
import { HELIUS_RPC, RPC_ENDPOINTS } from '../../constants';
import { throttledFetch } from '../utils';

export interface ChartTick {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export type Timeframe = '1S' | '1M' | '5M' | '15M' | '1H' | '1D';

/**
 * Fetches real historical OHLCV data from GeckoTerminal.
 */
export const getInitialChartData = async (
    address: string,
    currentPrice: number = 0,
    timeframe: Timeframe = '1M'
): Promise<ChartTick[]> => {
    try {
        const poolsRes = await throttledFetch(`/api/proxy/gecko?path=networks/solana/tokens/${address}/pools`).catch(() => ({ data: [] }));
        const topPool = poolsRes?.data?.[0];

        if (!topPool || !topPool.attributes?.address) {
            return [{ time: Math.floor(Date.now() / 1000), open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 }];
        }

        const poolAddress = topPool.attributes.address;
        let type = 'minute';
        let aggregate = 1;
        let limit = 1000;

        switch (timeframe) {
            case '5M': aggregate = 5; break;
            case '15M': aggregate = 15; break;
            case '1H': type = 'hour'; break;
            case '1D': type = 'day'; break;
        }

        const ohlcvRes = await throttledFetch(`/api/proxy/gecko?path=networks/solana/pools/${poolAddress}/ohlcv/${type}&aggregate=${aggregate}&limit=${limit}`);
        const rawList = ohlcvRes?.data?.attributes?.ohlcv_list || [];

        if (rawList.length === 0) {
            return [{ time: Math.floor(Date.now() / 1000), open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 }];
        }

        const fetchedTicks = rawList.map((item: any) => ({
            time: item[0],
            open: parseFloat(parseFloat(item[1]).toFixed(10)),
            high: parseFloat(parseFloat(item[2]).toFixed(10)),
            low: parseFloat(parseFloat(item[3]).toFixed(10)),
            close: parseFloat(parseFloat(item[4]).toFixed(10)),
            volume: parseFloat(item[5]) || 0
        })).sort((a: any, b: any) => a.time - b.time);

        const synthesized: ChartTick[] = [];
        const intervalSeconds = type === 'minute' ? 60 * aggregate : type === 'hour' ? 3600 : 86400;

        for (let i = 0; i < fetchedTicks.length; i++) {
            const current = fetchedTicks[i];
            const prev = synthesized[synthesized.length - 1];
            if (prev) {
                let fillTime = prev.time + intervalSeconds;
                while (fillTime < current.time) {
                    synthesized.push({
                        time: fillTime,
                        open: prev.close,
                        high: prev.close,
                        low: prev.close,
                        close: prev.close,
                        volume: 0
                    });
                    fillTime += intervalSeconds;
                }
            }
            synthesized.push(current);
        }
        return synthesized;
    } catch (e: any) {
        console.error("CHART_INIT_FAILURE:", e);
        return [];
    }
};

/**
 * Real-time price subscription.
 */
export const subscribeToTokenChart = (address: string, onTick: (tick: ChartTick) => void) => {
    let lastPrice = 0;
    let lastTime = 0;
    let isActive = true;
    let backoffDelay = 1000;
    let pollInterval: NodeJS.Timeout | null = null;

    const poll = async () => {
        if (!isActive) return;
        try {
            const now = Math.floor(Date.now() / 1000);
            if (now === lastTime) {
                pollInterval = setTimeout(poll, 100);
                return;
            }

            let currentPrice = 0;
            const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${address}`).catch(() => null);

            if (jupRes?.status === 200) {
                const data = await jupRes.json();
                currentPrice = parseFloat(data?.data?.[address]?.price || '0');
            }

            if (currentPrice > 0 && isActive) {
                const tick: ChartTick = {
                    time: now,
                    open: currentPrice,
                    high: currentPrice,
                    low: currentPrice,
                    close: currentPrice,
                    volume: 0
                };
                lastPrice = currentPrice;
                lastTime = now;
                onTick(tick);
                backoffDelay = 1000;
            }
        } catch {
            backoffDelay = Math.min(backoffDelay * 2, 30000);
        }

        if (isActive) {
            pollInterval = setTimeout(poll, backoffDelay);
        }
    };

    poll();
    return () => {
        isActive = false;
        if (pollInterval) clearTimeout(pollInterval);
    };
};
