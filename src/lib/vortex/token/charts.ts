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
 * Fetches real historical OHLCV data from Birdeye API via secure backend proxy.
 */
export const getInitialChartData = async (
    address: string,
    currentPrice: number = 0,
    timeframe: Timeframe = '1M'
): Promise<ChartTick[]> => {
    try {
        let type = '1m';
        let limit = 100;

        switch (timeframe) {
            case '1S': type = '1m'; limit = 60; break; // Birdeye lowest is 1m
            case '1M': type = '1m'; limit = 100; break;
            case '5M': type = '5m'; limit = 100; break;
            case '15M': type = '15m'; limit = 100; break;
            case '1H': type = '1H'; limit = 100; break;
            case '1D': type = '1D'; limit = 90; break;
        }

        // Calculate time range (Birdeye uses UNIX SECONDS)
        const time_to = Math.floor(Date.now() / 1000);

        let intervalSeconds = 60;
        if (type === '5m') intervalSeconds = 300;
        if (type === '15m') intervalSeconds = 900;
        if (type === '1H') intervalSeconds = 3600;
        if (type === '1D') intervalSeconds = 86400;

        const time_from = time_to - (limit * intervalSeconds);

        const res = await fetch(`/api/proxy/birdeye?address=${address}&type=${type}&time_from=${time_from}&time_to=${time_to}`);
        if (!res.ok) {
            console.warn("BIRDEYE_PROXY_FAIL", await res.text());
            throw new Error("BIRDEYE_UNAVAILABLE");
        }

        const json = await res.json();
        const items = json?.data?.items || [];

        if (items.length === 0) {
            return [{ time: Math.floor(Date.now() / 1000), open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 }];
        }

        // Map Birdeye response to Lightweight ChartTick format
        const fetchedTicks: ChartTick[] = items.map((item: any) => ({
            time: item.unixTime, // Birdeye returns unixTime in seconds natively
            open: parseFloat((item.o || currentPrice).toFixed(10)),
            high: parseFloat((item.h || currentPrice).toFixed(10)),
            low: parseFloat((item.l || currentPrice).toFixed(10)),
            close: parseFloat((item.c || currentPrice).toFixed(10)),
            volume: parseFloat(item.v || 0)
        })).sort((a: any, b: any) => a.time - b.time);

        // Fill gap logic (Birdeye skips missing candles if volume is 0)
        const synthesized: ChartTick[] = [];
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

        // Ensure the last candle respects the true live price
        if (synthesized.length > 0 && currentPrice > 0) {
            const last = synthesized[synthesized.length - 1];
            last.close = currentPrice;
            if (currentPrice > last.high) last.high = currentPrice;
            if (currentPrice < last.low) last.low = currentPrice;
        }

        return synthesized;
    } catch (e: any) {
        console.error("CHART_INIT_FAILURE:", e);
        // Fallback flatline so the component doesn't crash fully
        return [{ time: Math.floor(Date.now() / 1000), open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 }];
    }
};

/**
 * Real-time price subscription via server-side proxy.
 * Routes through /api/proxy/jup-price to avoid browser CORS blocks.
 * Implements non-aggressive polling at 1.5s intervals.
 */
export const subscribeToTokenChart = (address: string, onTick: (tick: ChartTick) => void) => {
    let lastPrice = 0;
    let lastTime = 0;
    let isActive = true;
    let backoffDelay = 1500; // 1.5s base — more respectful of API limits
    let pollInterval: NodeJS.Timeout | null = null;

    const poll = async () => {
        if (!isActive) return;
        try {
            const now = Math.floor(Date.now() / 1000);

            // Debounce: don't re-tick the same second
            if (now === lastTime) {
                pollInterval = setTimeout(poll, 200);
                return;
            }

            let currentPrice = 0;

            // FIX: Route through server-side proxy to avoid CORS block
            const jupRes = await fetch(`/api/proxy/jup-price?ids=${address}`).catch(() => null);

            if (jupRes?.ok) {
                const data = await jupRes.json();
                currentPrice = parseFloat(data?.data?.[address]?.price || '0');
            }

            if (currentPrice > 0 && isActive) {
                const tick: ChartTick = {
                    time: now,
                    open: lastPrice > 0 ? lastPrice : currentPrice,
                    high: Math.max(lastPrice > 0 ? lastPrice : currentPrice, currentPrice),
                    low: Math.min(lastPrice > 0 ? lastPrice : currentPrice, currentPrice),
                    close: currentPrice,
                    volume: 0
                };
                lastPrice = currentPrice;
                lastTime = now;
                onTick(tick);
                backoffDelay = 1500; // Reset on success
            }
        } catch {
            // Exponential backoff capped at 15s (faster recovery than before)
            backoffDelay = Math.min(backoffDelay * 1.5, 15000);
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
