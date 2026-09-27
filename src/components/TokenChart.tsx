'use client';
import { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, Time } from 'lightweight-charts';
import { ChartTick, Timeframe, VortexTx } from '@/lib/dataService';

interface TokenChartProps {
    address: string;
    initialData: ChartTick[];
    realtimeTx: VortexTx | null; // Use raw transactions instead of pre-computed poll ticks
    timeframe: Timeframe;
    onTimeframeChange: (tf: Timeframe | any) => void;
}

// Bug fix: lightweight-charts draws to <canvas>, so it cannot consume CSS custom
// properties directly — it needs resolved color strings. Reading them from the DOM
// here (instead of hardcoding hex a second time) keeps the chart's brand colors
// driven by the single source of truth in globals.css :root.
function cssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

export function TokenChart({ address, initialData, realtimeTx, timeframe, onTimeframeChange }: TokenChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<any>(null);
    const ema20SeriesRef = useRef<any>(null);
    const ema50SeriesRef = useRef<any>(null);
    const rsiSeriesRef = useRef<any>(null);
    const volumeSeriesRef = useRef<any>(null);
    const legendRef = useRef<HTMLDivElement>(null);

    // CANDLE_STATE_MACHINE: Track the current forming candle to enforce OHLC locking
    const currentCandleRef = useRef<ChartTick | null>(null);
    const lastCloseRef = useRef<number>(0);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: cssVar('--text-secondary', '#A1A1AA'),
                fontSize: 11,
                fontFamily: 'JetBrains Mono',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                timeVisible: true,
                secondsVisible: true,
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,
            },
        });

        const upColor = cssVar('--accent-vortex-yellow', '#E5FF00');
        const downColor = cssVar('--accent-vortex-red', '#EF4444');

        const series = chart.addCandlestickSeries({
            upColor,
            downColor,
            borderVisible: false,
            wickUpColor: upColor,
            wickDownColor: downColor,
            priceFormat: {
                type: 'price',
                precision: 9, // Increased for extreme memecoins
                minMove: 0.000000001,
            },
        });

        series.priceScale().applyOptions({
            autoScale: true,
            scaleMargins: {
                top: 0.05, // Reduced from 0.1
                bottom: 0.15, // Reduced from 0.2
            },
        });

        const volumeSeries = chart.addHistogramSeries({
            color: upColor,
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', // overlay
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        // 3. Tactical EMA Overlays
        const ema20Series = chart.addLineSeries({
            color: 'rgba(168, 85, 247, 0.6)', // Vortex Purple
            lineWidth: 1,
            priceScaleId: 'right',
            title: 'EMA 20',
        });

        const ema50Series = chart.addLineSeries({
            color: 'rgba(59, 130, 246, 0.6)', // Blue
            lineWidth: 1,
            priceScaleId: 'right',
            title: 'EMA 50',
        });

        // 4. RSI Series (Separate Price Scale / Bottom Pane Heuristic)
        const rsiSeries = chart.addLineSeries({
            color: '#F59E0B', // Amber
            lineWidth: 1,
            priceScaleId: 'rsi',
            title: 'RSI',
        });

        chart.priceScale('rsi').applyOptions({
            scaleMargins: {
                top: 0.7,
                bottom: 0.1,
            },
            visible: true,
            borderVisible: false,
        });

        chartRef.current = chart;
        seriesRef.current = series;
        ema20SeriesRef.current = ema20Series;
        ema50SeriesRef.current = ema50Series;
        rsiSeriesRef.current = rsiSeries;
        volumeSeriesRef.current = volumeSeries;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
            ema20SeriesRef.current = null;
            ema50SeriesRef.current = null;
            rsiSeriesRef.current = null;
            volumeSeriesRef.current = null;
        };
    }, []); // Initialize chart canvas ONLY ONCE to prevent memory leaks

    // Handle Data Hydration separately
    useEffect(() => {
        if (!seriesRef.current || !chartRef.current || !initialData || initialData.length === 0) return;

        const chartData = initialData.map(d => ({
            time: d.time as Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));

        const volumeData = initialData.map(d => ({
            time: d.time as Time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(20, 241, 149, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        }));

        try {
            seriesRef.current.setData(chartData);
            volumeSeriesRef.current.setData(volumeData);

            // TACTICALMemoization: Indicators only recalculate when chartData or address changes
            const ema20 = calculateEMA(chartData, 20);
            const ema50 = calculateEMA(chartData, 50);
            const rsi = calculateRSI(chartData, 14);

            ema20SeriesRef.current.setData(ema20);
            ema50SeriesRef.current.setData(ema50);
            rsiSeriesRef.current.setData(rsi);

            // CRITICAL: Force chart to fit all data, eliminating blank space
            chartRef.current.timeScale().fitContent();

            // Legend Update (HUD)
            if (legendRef.current && rsi.length > 0) {
                const lRsi = rsi[rsi.length - 1].value;
                const lEma20 = ema20[ema20.length - 1].value;
                const lEma50 = ema50[ema50.length - 1]?.value;

                // NOTE: EMA20/EMA50/RSI dot+line colors (purple/blue/amber) are a
                // data-viz indicator palette, distinct from the brand accent tokens —
                // left as-is intentionally. Swapped only the panel chrome and the
                // muted labels to reference the real tokens instead of re-deriving them.
                legendRef.current.innerHTML = `
                    <div class="glass-panel" style="padding: 6px 12px; font-size: 10px; border-radius: 2px; background: var(--surface-glass); backdrop-filter: blur(8px); border: var(--border-vortex);">
                        <div style="display: flex; gap: 12px; font-family: 'JetBrains Mono', monospace; font-weight: 700; letter-spacing: 0.5px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(168, 85, 247, 0.8);"></div>
                                <span style="color: var(--text-secondary)">EMA_20:</span>
                                <span style="color: rgba(168, 85, 247, 1)">${lEma20.toFixed(6)}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(59, 130, 246, 0.8);"></div>
                                <span style="color: var(--text-secondary)">EMA_50:</span>
                                <span style="color: rgba(59, 130, 246, 1)">${lEma50.toFixed(6)}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 6px; height: 6px; border-radius: 50%; background: #F59E0B;"></div>
                                <span style="color: var(--text-secondary)">RSI:</span>
                                <span style="color: #F59E0B">${lRsi.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Whale Recon Markers: only the largest few spikes, otherwise labels bury the candles.
            const MAX_WHALE_MARKERS = 5;
            const avgVol = volumeData.reduce((acc, d) => acc + d.value, 0) / volumeData.length;
            const markers = initialData
                .filter(d => d.volume > avgVol * 4)
                .sort((a, b) => b.volume - a.volume)
                .slice(0, MAX_WHALE_MARKERS)
                .map(d => ({
                    time: d.time as Time,
                    position: 'aboveBar' as const,
                    color: cssVar('--accent-vortex-yellow', '#E5FF00'),
                    shape: 'arrowDown' as const,
                    text: 'Whale',
                }))
                .sort((a, b) => (a.time as number) - (b.time as number));

            seriesRef.current.setMarkers(markers);
        } catch (e) {
            console.error("LW_CHART_HYDRATION_ERROR: Invalid or Corrupted Time Series Data", e);
            // Non-fatal graceful degradation: Chart remains blank, app survives
        }
    }, [initialData]);



    // CANDLE_ENGINE: State-aware tick aggregator
    useEffect(() => {
        if (seriesRef.current && (realtimeTx || (initialData?.length > 0 && lastCloseRef.current === 0))) {
            try {
                // Initialize lastClose from historical data
                if (lastCloseRef.current === 0 && initialData.length > 0) {
                    lastCloseRef.current = initialData[initialData.length - 1].close;
                }

                if (!realtimeTx) return;

                const getIntervalSeconds = (tf: string): number => {
                    switch (tf) {
                        case '1S': return 1;
                        case '1M': return 60;
                        case '5M': return 300;
                        case '15M': return 900;
                        case '1H': return 3600;
                        case '1D': return 86400;
                        default: return 60;
                    }
                };

                const interval = getIntervalSeconds(timeframe);
                const snappedTime = Math.floor(realtimeTx.blockTime / interval) * interval;
                const price = realtimeTx.priceUsd || 0;
                if (price === 0) return;

                // STASH: Previous candle state
                let candle = currentCandleRef.current;

                // NEW_CANDLE_DETECTION: If the snapped time has progressed, we must seal the old candle
                if (!candle || snappedTime > candle.time) {
                    // SEAMLESS_TRANSITION: New candle MUST open at the exact price the previous one closed
                    const openPrice = lastCloseRef.current || price;

                    candle = {
                        time: snappedTime,
                        open: openPrice,
                        high: Math.max(openPrice, price),
                        low: Math.min(openPrice, price),
                        close: price,
                        volume: realtimeTx.amountUsd || 0
                    };
                } else {
                    // ACCUMULATION: Update existing candle High/Low and volume
                    candle.high = Math.max(candle.high, price);
                    candle.low = Math.min(candle.low, price);
                    candle.close = price;
                    candle.volume += (realtimeTx.amountUsd || 0);
                }

                // COMMIT: Push to Lightweight Charts
                seriesRef.current.update({
                    time: candle.time as any,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                });

                if (volumeSeriesRef.current) {
                    volumeSeriesRef.current.update({
                        time: candle.time as any,
                        value: candle.volume,
                        color: candle.close >= candle.open ? 'rgba(20, 241, 149, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                    });
                }

                currentCandleRef.current = candle;
                lastCloseRef.current = price;

            } catch (err) {
                console.debug("Ignored desync tick in CandleEngine");
            }
        }
    }, [realtimeTx, timeframe, initialData]);

    return (
        <div className="vortex-relative vortex-full-size vortex-chart-h">
            {/* Control Bar HUD */}
            <div className="vortex-abs-top-right vortex-p-4 vortex-z-10 vortex-flex vortex-gap-2">
                {['1S', '1M', '5M', '15M', '1H', '1D'].map(tf => (
                    <button
                        type="button"
                        key={tf}
                        className={`btn-vortex-mini ${tf === timeframe ? 'active text-vortex-yellow' : 'vortex-text-muted'} vortex-text-tiny`}
                        onClick={() => onTimeframeChange(tf as Timeframe)}
                        aria-pressed={tf === timeframe}
                    >
                        {tf}
                    </button>
                ))}
            </div>

            <>
                <div
                    ref={chartContainerRef}
                    className="vortex-full-size"
                    role="img"
                    aria-label="Interactive Token Price Chart"
                />
                {(!initialData || initialData.length <= 1) && (
                    <div className="vortex-abs-center vortex-z-20 vortex-flex-column vortex-center vortex-bg-obsidian-90 vortex-p-6 vortex-border-vortex">
                        <span className="vortex-text-red vortex-text-bold vortex-font-mono animate-pulse vortex-mb-2">
                            [!] DATA_UPLINK_DEGRADED
                        </span>
                        <span className="vortex-text-tiny vortex-text-muted vortex-text-center">
                            Historical OHLCV stream is currently unavailable.<br />
                            Real-time telemetry is still active.
                        </span>
                    </div>
                )}
            </>

            {/* Indicator Legend HUD */}
            <div
                ref={legendRef}
                className="vortex-abs-top-left vortex-p-4 vortex-z-10"
                style={{ pointerEvents: 'none' }}
            />
        </div>
    );
}

function calculateEMA(data: any[], period: number) {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    let ema = data[0].close;
    const result = [{ time: data[0].time, value: ema }];

    for (let i = 1; i < data.length; i++) {
        ema = (data[i].close - ema) * k + ema;
        result.push({ time: data[i].time, value: ema });
    }
    return result;
}

function calculateRSI(data: any[], period: number) {
    if (data.length < period + 1) return [];
    const result = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        result.push({ time: data[i].time, value: rsi });
    }
    return result;
}
