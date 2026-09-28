'use client';
import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { ChartTick, Timeframe, VortexTx } from '@/lib/dataService';

interface TokenChartProps {
    address: string;
    initialData: ChartTick[];
    realtimeTx: VortexTx | null;
    timeframe: Timeframe;
    onTimeframeChange: (tf: Timeframe) => void;
}
const frames: { value: Timeframe; label: string; seconds: number }[] = [
    { value: '1M', label: '1m', seconds: 60 }, { value: '5M', label: '5m', seconds: 300 },
    { value: '15M', label: '15m', seconds: 900 }, { value: '1H', label: '1h', seconds: 3600 },
    { value: '1D', label: '1d', seconds: 86400 },
];
function color(name: string) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export function TokenChart({ address, initialData, realtimeTx, timeframe, onTimeframeChange }: TokenChartProps) {
    const container = useRef<HTMLDivElement>(null);
    const chart = useRef<IChartApi | null>(null);
    const candles = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumes = useRef<ISeriesApi<'Histogram'> | null>(null);
    const current = useRef<ChartTick | null>(null);
    const lastSignature = useRef('');
    const fitted = useRef(false);
    const [chartError, setChartError] = useState(false);
    useEffect(() => {
        if (!container.current) return;
        const instance = createChart(container.current, {
            layout: { background: { type: ColorType.Solid, color: color('--surface-panel') }, textColor: color('--text-secondary'), fontSize: 11, fontFamily: 'monospace' },
            grid: { vertLines: { color: color('--surface-elevated') }, horzLines: { color: color('--surface-elevated') } },
            width: container.current.clientWidth, height: container.current.clientHeight,
            timeScale: { borderColor: color('--vortex-line'), timeVisible: true, secondsVisible: false, rightOffset: 4 },
            rightPriceScale: { borderColor: color('--vortex-line'), scaleMargins: { top: 0.12, bottom: 0.25 } },
            handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
            handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
        });
        chart.current = instance;
        candles.current = instance.addCandlestickSeries({
            upColor: color('--accent-vortex-yellow'), downColor: color('--vortex-negative'),
            borderVisible: false, wickUpColor: color('--accent-vortex-yellow'), wickDownColor: color('--vortex-negative'),
        });
        volumes.current = instance.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
        volumes.current.priceScale().applyOptions({ scaleMargins: { top: 0.83, bottom: 0 } });
        const observer = new ResizeObserver(() => {
            if (container.current) instance.applyOptions({ width: container.current.clientWidth, height: container.current.clientHeight });
        });
        observer.observe(container.current);
        return () => { observer.disconnect(); instance.remove(); chart.current = null; candles.current = null; volumes.current = null; };
    }, []);
    useEffect(() => {
        if (!chart.current || !candles.current || !volumes.current) return;
        const valid = [...new Map(initialData.filter(d => [d.time, d.open, d.high, d.low, d.close, d.volume].every(Number.isFinite) && d.time > 0 && d.low > 0 && d.high >= Math.max(d.open, d.close) && d.low <= Math.min(d.open, d.close) && d.volume >= 0).map(d => [d.time, d])).values()].sort((a, b) => a.time - b.time);
        try {
            const price = valid.at(-1)?.close || 1;
            const precision = price >= 1 ? 2 : Math.min(12, Math.max(4, -Math.floor(Math.log10(price)) + 3));
            candles.current.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } });
            candles.current.setData(valid.map(d => ({ ...d, time: d.time as Time })));
            volumes.current.setData(valid.map(d => ({ time: d.time as Time, value: d.volume, color: color(d.close >= d.open ? '--accent-vortex-yellow' : '--vortex-negative') + '55' })));
            current.current = valid.length ? { ...valid[valid.length - 1] } : null;
            if (!fitted.current && valid.length) { chart.current.timeScale().fitContent(); fitted.current = true; }
            setChartError(initialData.length > 0 && !valid.length);
        } catch { setChartError(true); }
    }, [initialData]);
    useEffect(() => {
        if (!realtimeTx || !candles.current || !volumes.current || realtimeTx.signature === lastSignature.current) return;
        const price = realtimeTx.priceUsd;
        if (!price || !Number.isFinite(price) || price <= 0 || !Number.isFinite(realtimeTx.blockTime)) return;
        const interval = frames.find(frame => frame.value === timeframe)?.seconds || 60;
        const time = Math.floor(realtimeTx.blockTime / interval) * interval;
        const previous = current.current;
        if (previous && time < previous.time) return;
        const volume = Number.isFinite(realtimeTx.amountUsd) && realtimeTx.amountUsd! >= 0 ? realtimeTx.amountUsd! : 0;
        const next = previous && time === previous.time
            ? { ...previous, high: Math.max(previous.high, price), low: Math.min(previous.low, price), close: price, volume: previous.volume + volume }
            : { time, open: price, high: price, low: price, close: price, volume };
        candles.current.update({ ...next, time: time as Time });
        volumes.current.update({ time: time as Time, value: next.volume, color: color(next.close >= next.open ? '--accent-vortex-yellow' : '--vortex-negative') + '55' });
        current.current = next;
        lastSignature.current = realtimeTx.signature;
    }, [realtimeTx, timeframe]);
    return <div className="vortex-chart-shell">
        <div className="vortex-chart-controls" role="group" aria-label="Chart timeframe"><span>PRICE / USD</span>{frames.map(frame => <button key={frame.value} type="button" aria-pressed={frame.value === timeframe} onClick={() => onTimeframeChange(frame.value)}>{frame.label}</button>)}</div>
        <div ref={container} className="vortex-chart-canvas" role="region" aria-label={'USD candlestick and volume chart for ' + address + ', ' + timeframe + ' interval'} />
        {(chartError || initialData.length < 2) && <div className="vortex-chart-empty"><strong>Price history unavailable</strong><p>The provider has not returned enough candles. Try another timeframe or refresh the token data.</p></div>}
        <div className="vortex-chart-legend">Candlesticks · USD volume · Scroll to zoom, drag to explore</div>
    </div>;
}
