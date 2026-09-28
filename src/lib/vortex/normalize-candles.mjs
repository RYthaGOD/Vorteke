/** @param {Array<Record<string, unknown>>} items */
export function normalizeCandles(items) {
    const candles = items.map(item => ({
        time: Number(item.unixTime ?? item.unix_time),
        open: Number(item.o ?? item.open), high: Number(item.h ?? item.high),
        low: Number(item.l ?? item.low), close: Number(item.c ?? item.close),
        volume: Number(item.v ?? item.volume ?? 0),
    })).filter(candle => Object.values(candle).every(Number.isFinite) && Number.isInteger(candle.time) && candle.time > 0 &&
        candle.open > 0 && candle.close > 0 && candle.low > 0 && candle.high >= Math.max(candle.open, candle.close) &&
        candle.low <= Math.min(candle.open, candle.close) && candle.volume >= 0);
    return [...new Map(candles.map(candle => [candle.time, candle])).values()].sort((a, b) => a.time - b.time);
}
