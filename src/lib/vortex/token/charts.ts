import { aetherClient } from '../aetherClient';

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
 * Fallback Chain: AetherIndex (Sovereign) -> Birdeye (Backup) -> GeckoTerminal (Deep History) -> Empty.
 */
export const getInitialChartData = async (
    address: string,
    currentPrice: number = 0,
    timeframe: Timeframe = '1M'
): Promise<ChartTick[]> => {
    try {
        // 0. Sovereign Primary: AetherIndex
        let aetherInterval = '1 minute';
        switch (timeframe) {
            case '1S': aetherInterval = '1 second'; break;
            case '1M': aetherInterval = '1 minute'; break;
            case '5M': aetherInterval = '5 minutes'; break;
            case '15M': aetherInterval = '15 minutes'; break;
            case '1H': aetherInterval = '1 hour'; break;
            case '1D': aetherInterval = '1 day'; break;
        }

        try {
            const aetherHistory = await aetherClient.getHistory(address, aetherInterval);
            if (aetherHistory && aetherHistory.length > 5) {
                return normalizeAndHarden(aetherHistory.map(h => ({
                    unix_time: Math.floor(new Date(h.window_start).getTime() / 1000),
                    o: h.open,
                    h: h.high,
                    l: h.low,
                    c: h.close,
                    v: h.volume
                })), currentPrice);
            }
        } catch (err) {
            console.warn("AETHER_BYPASS: Primary indexer offline or missing coverage.", err);
        }

        // 1. Secondary Attempt: Birdeye
        let birdeyeType = '1m';
        let intervalSeconds = 60;

        switch (timeframe) {
            case '1S': birdeyeType = '1m'; intervalSeconds = 60; break;
            case '1M': birdeyeType = '1m'; intervalSeconds = 60; break;
            case '5M': birdeyeType = '5m'; intervalSeconds = 300; break;
            case '15M': birdeyeType = '15m'; intervalSeconds = 900; break;
            case '1H': birdeyeType = '1H'; intervalSeconds = 3600; break;
            case '1D': birdeyeType = '1D'; intervalSeconds = 86400; break;
        }

        const time_to = Math.floor(Date.now() / 1000);
        const birdeyeRes = await fetch(`/api/proxy/birdeye?address=${address}&type=${birdeyeType}&time_from=${time_to - (5000 * intervalSeconds)}&time_to=${time_to}`, {
            signal: AbortSignal.timeout(10000)
        });

        if (birdeyeRes.ok) {
            const json = await birdeyeRes.json();
            const items = json?.data?.items || [];
            if (items.length > 5) {
                return normalizeAndHarden(items, currentPrice);
            }
        }

        // 2. Tertiary Attempt: GeckoTerminal (The Paginated Oracle)
        console.warn(`ORACLE_FALLBACK: Attempting Deep GeckoTerminal Fetch for ${address}`);
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

        const allOhlcv: any[] = [];
        const fetchGeckoBatch = async (beforeTs?: number) => {
            const url = `/api/proxy/geckoterminal?address=${address}&type=${geckoType}&aggregate=${geckoAggregate}&limit=1000${beforeTs ? `&before_timestamp=${beforeTs}` : ''}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (!res.ok) return null;
            const json = await res.json();
            return json?.data?.attributes?.ohlcv_list || [];
        };

        const batch1 = await fetchGeckoBatch();
        if (batch1 && batch1.length > 0) {
            allOhlcv.push(...batch1);
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
        last.close = currentPrice;
        if (currentPrice > last.high) last.high = currentPrice;
        if (currentPrice < last.low) last.low = currentPrice;
    }

    return fetchedTicks;
};

/**
 * DEPRECATED: Use subscribeToLiveStream for unified price/transaction feed.
 */
export const subscribeToTokenChart = (address: string, onTick: (tick: ChartTick) => void) => {
    return () => { };
};
