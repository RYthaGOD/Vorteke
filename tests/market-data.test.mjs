import test from 'node:test';
import assert from 'node:assert/strict';
import { measureTrendingWindow } from '../src/lib/vortex/trending-window.mjs';
import { normalizeCandles } from '../src/lib/vortex/normalize-candles.mjs';
const end = 1800000000;
const makeWindow = () => Array.from({ length: 30 }, (_, i) => [end - 1800 + i * 60, 100 + i, 102 + i, 99 + i, 101 + i, 10]);
test('30-minute ranking sums precisely 30 closed candles, irrespective of order', () => {
    const result = measureTrendingWindow(makeWindow().reverse(), end);
    assert.equal(result.volume30m, 300);
    assert.equal(result.priceUsd, 130);
    assert.ok(Math.abs(result.priceChange30m - 30) < 1e-10);
    assert.equal(result.prices.length, 30);
});
test('excludes current and older candles, and does not double count duplicates', () => {
    const candles = makeWindow();
    const result = measureTrendingWindow([...candles, candles[0], [end, 1, 2, 1, 2, 9999], [end - 1860, 1, 2, 1, 2, 9999]], end);
    assert.equal(result.volume30m, 300);
});
test('never relabels partial, malformed or missing history as a complete 30m window', () => {
    assert.equal(measureTrendingWindow(makeWindow().slice(1), end), null);
    const invalid = makeWindow(); invalid[10][5] = -1;
    assert.equal(measureTrendingWindow(invalid, end), null);
    assert.equal(measureTrendingWindow(null, end), null);
    assert.equal(measureTrendingWindow(makeWindow(), end + 1), null);
    const nan = makeWindow(); nan[10][4] = NaN;
    assert.equal(measureTrendingWindow(nan, end), null);
});
test('flat history produces zero change without fabricated movement', () => {
    const result = measureTrendingWindow(makeWindow().map(row => [row[0], 1, 1, 1, 1, 0]), end);
    assert.equal(result.priceChange30m, 0);
    assert.equal(result.volume30m, 0);
});
test('normalizes numeric strings without rounding away tiny token prices', () => {
    const candles = normalizeCandles([{ unix_time: 60, o: '0.0000000000123', h: '0.000000000013', l: '0.000000000012', c: '0.0000000000128', v: '0' }]);
    assert.equal(candles[0].close, 0.0000000000128);
    assert.equal(candles[0].volume, 0);
});
test('normalization preserves historical closes and rejects impossible candles', () => {
    const valid = { unix_time: 120, o: 10, h: 12, l: 9, c: 11, v: 100 };
    const result = normalizeCandles([valid, { ...valid, unix_time: 60, c: 10 }, valid, { ...valid, unix_time: 180, h: 1 }, { ...valid, unix_time: 240, c: NaN }]);
    assert.deepEqual(result.map(c => c.time), [60, 120]);
    assert.equal(result[1].close, 11);
});
