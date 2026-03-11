import { Connection } from '@solana/web3.js';
import { HELIUS_RPC, RPC_ENDPOINTS } from '../../constants';

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
 * Fetches resilient historical OHLCV data.
 * Fallback Chain: Birdeye (Primary) -> GeckoTerminal (Secondary) -> Empty.
 */
export const getInitialChartData = async (
    address: string,
    currentPrice: number = 0,
    timeframe: Timeframe = '1M'
): Promise<ChartTick[]> => {
    try {
        // 1. Primary Attempt: Birdeye
        let birdeyeType = '1m';
        let limit = 1000;
        let intervalSeconds = 60;

        switch (timeframe) {
            case '1S': birdeyeType = '1m'; limit = 60; intervalSeconds = 60; break;
            case '1M': birdeyeType = '1m'; limit = 1000; intervalSeconds = 60; break;
            case '5M': birdeyeType = '5m'; limit = 1000; intervalSeconds = 300; break;
            case '15M': birdeyeType = '15m'; limit = 1000; intervalSeconds = 900; break;
            case '1H': birdeyeType = '1H'; limit = 1000; intervalSeconds = 3600; break;
            case '1D': birdeyeType = '1D'; limit = 365; intervalSeconds = 86400; break;
        }

        const time_to = Math.floor(Date.now() / 1000);
        const birdeyeRes = await fetch(`/api/proxy/birdeye?address=${address}&type=${birdeyeType}&time_from=${time_to - (5000 * intervalSeconds)}&time_to=${time_to}`);

        if (birdeyeRes.ok) {
            const json = await birdeyeRes.json();
            const items = json?.data?.items || [];
            // If we have data, we can try to fetch more if needed, but 5000 is usually enough for most 1M/5M views.
            // For full history, we pivot to GeckoTerminal which is more reliable for deep pagination.
            if (items.length > 5) {
                return normalizeAndHarden(items, currentPrice);
            }
        }

        // 2. Secondary Attempt: GeckoTerminal (The Paginated Oracle)
        console.warn(`BIRDEYE_COLD: Attempting Deep GeckoTerminal Fetch for ${address}`);
        let geckoType = 'minute';
        let geckoAggregate = '1';

        switch (timeframe) {
            case '1S': geckoType = 'minute'; geckoAggregate = '1'; break;
            case '1M': geckoType = 'minute'; geckoAggregate = '1'; break;
            case '5M': geckoType = 'minute'; geckoAggregate = '5'; break;
            case '15M': geckoType = 'minute'; geckoAggregate = '15'; break;
            case '1H': geckoType = 'hour'; geckoAggregate = '1'; break;
            case '1D': geckoType = 'day'; geckoAggregate = '1'; break;
        }

        // DEEP_FETCH_LOGIC: We fetch the first batch, then if it's full, we fetch one more batch back in time.
        // This gives us ~2000 candles which is the "Golden Range" for professional charting.
        const allOhlcv: any[] = [];

        const fetchGeckoBatch = async (beforeTs?: number) => {
            const url = `/api/proxy/geckoterminal?address=${address}&type=${geckoType}&aggregate=${geckoAggregate}&limit=1000${beforeTs ? `&before_timestamp=${beforeTs}` : ''}`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const json = await res.json();
            return json?.data?.attributes?.ohlcv_list || [];
        };

        const batch1 = await fetchGeckoBatch();
        if (batch1 && batch1.length > 0) {
            allOhlcv.push(...batch1);

            // If batch 1 is full, it's likely a mature token. Get one more batch for "Eternal" feel.
            if (batch1.length >= 900) {
                const earliestTs = batch1[batch1.length - 1][0];
                const batch2 = await fetchGeckoBatch(earliestTs);
                if (batch2) allOhlcv.push(...batch2);
            }
        }

        if (allOhlcv.length > 0) {
            const mappedItems = allOhlcv.map((item: any) => ({
                unix_time: item[0],
                o: item[1],
                h: item[2],
                l: item[3],
                c: item[4],
                v: item[5]
            }));
            return normalizeAndHarden(mappedItems, currentPrice);
        }

        return [];
    } catch (e: any) {
        console.error("CHART_INIT_FAILURE_CRITICAL:", e);
        return [];
    }
};

/**
 * Normalizes diverse provider formats into the Vortex ChartTick standard.
 * TACTICAL_RESTORE: Gap-filling has been DISABLED to ensure chart transparency.
 * Gaps in the time series now honestly reflect periods of zero liquidity/trading.
 */
const normalizeAndHarden = (items: any[], currentPrice: number): ChartTick[] => {
    const fetchedTicks: ChartTick[] = items.map((item: any) => ({
        time: item.unixTime || item.unix_time,
        open: parseFloat((item.o || item.open || currentPrice).toFixed(10)),
        high: parseFloat((item.h || item.high || currentPrice).toFixed(10)),
        low: parseFloat((item.l || item.low || currentPrice).toFixed(10)),
        close: parseFloat((item.c || item.close || currentPrice).toFixed(10)),
        volume: parseFloat(item.v || item.volume || 0)
    })).filter((t: ChartTick) => t.time > 0).sort((a: any, b: any) => a.time - b.time);

    if (fetchedTicks.length > 0 && currentPrice > 0) {
        const last = fetchedTicks[fetchedTicks.length - 1];
        // Ensure the absolute latest tick reflects the live Oracle price
        last.close = currentPrice;
        if (currentPrice > last.high) last.high = currentPrice;
        if (currentPrice < last.low) last.low = currentPrice;
    }

    return fetchedTicks;
};

/**
 * DEPRECATED: Use subscribeToLiveStream for unified price/transaction feed.
 * Legacy poll-based price subscription.
 */
export const subscribeToTokenChart = (address: string, onTick: (tick: ChartTick) => void) => {
    // Returning dummy cleanup to prevent breaking callers temporarily
    return () => { };
};
