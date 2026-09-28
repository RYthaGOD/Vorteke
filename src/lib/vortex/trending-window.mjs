/**
 * Measure the last 30 completed one-minute candles. Incomplete history is
 * excluded rather than presenting a shorter window as a 30-minute result.
 * @param {unknown} input
 * @param {number} windowEnd Unix seconds, exclusive
 */
export function measureTrendingWindow(input, windowEnd) {
    if (!Array.isArray(input) || !Number.isFinite(windowEnd) || windowEnd % 60 !== 0) return null;
    const start = windowEnd - 1800;
    const unique = new Map();
    for (const row of input) {
        if (!Array.isArray(row) || row.length < 6 || !row.slice(0, 6).every(v => typeof v === 'number' && Number.isFinite(v))) continue;
        const [time, open, high, low, close, volume] = row;
        if (time < start || time >= windowEnd || time % 60 || open <= 0 || close <= 0 || low <= 0 || high < Math.max(open, close) || low > Math.min(open, close) || volume < 0) continue;
        unique.set(time, { time, open, close, volume });
    }
    const candles = [...unique.values()].sort((a, b) => a.time - b.time);
    if (candles.length !== 30) return null;
    const first = candles[0], last = candles[29];
    return {
        priceUsd: last.close,
        priceChange30m: (last.close / first.open - 1) * 100,
        volume30m: candles.reduce((sum, candle) => sum + candle.volume, 0),
        prices: candles.map(candle => candle.close),
    };
}
