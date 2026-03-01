'use client';
import { useEffect, useRef } from 'react';
import { createChart, ColorType, Time } from 'lightweight-charts';
import { ChartTick, Timeframe } from '@/lib/dataService';

interface TokenChartProps {
    initialData: ChartTick[];
    realtimeData: ChartTick | null;
    timeframe: Timeframe;
    onTimeframeChange: (tf: Timeframe | any) => void;
}

export function TokenChart({ initialData, realtimeData, timeframe, onTimeframeChange }: TokenChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<any>(null);
    const ema20SeriesRef = useRef<any>(null);
    const ema50SeriesRef = useRef<any>(null);
    const rsiSeriesRef = useRef<any>(null);
    const volumeSeriesRef = useRef<any>(null);
    const legendRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#A1A1AA',
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

        const series = chart.addCandlestickSeries({
            upColor: '#E5FF00',
            downColor: '#EF4444',
            borderVisible: false,
            wickUpColor: '#E5FF00',
            wickDownColor: '#EF4444',
            priceFormat: {
                type: 'price',
                precision: 9, // Increased for extreme memecoins
                minMove: 0.000000001,
            },
        });

        series.priceScale().applyOptions({
            autoScale: true,
            scaleMargins: {
                top: 0.1,
                bottom: 0.2,
            },
        });

        const volumeSeries = chart.addHistogramSeries({
            color: '#E5FF00',
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

            // Indicators
            const ema20 = calculateEMA(chartData, 20);
            const ema50 = calculateEMA(chartData, 50);
            const rsi = calculateRSI(chartData, 14);

            ema50SeriesRef.current.setData(ema50);
            rsiSeriesRef.current.setData(rsi);

            // Update Legend with final values
            if (legendRef.current && rsi.length > 0) {
                const lastRsi = rsi[rsi.length - 1].value;
                const lastEma20 = ema20[ema20.length - 1].value;
                legendRef.current.innerHTML = `
                    <div class="vortex-flex vortex-gap-3 vortex-text-tiny">
                        <span style="color: rgba(168, 85, 247, 0.9)">EMA 20: ${lastEma20.toFixed(6)}</span>
                        <span style="color: rgba(59, 130, 246, 0.9)">EMA 50: ${ema50[ema50.length - 1]?.value.toFixed(6)}</span>
                        <span style="color: #F59E0B">RSI: ${lastRsi.toFixed(2)}</span>
                    </div>
                `;
            }

            // Add specialized markers based on volume anomalies (Real Whale Recon)
            const avgVolume = volumeData.reduce((acc, d) => acc + d.value, 0) / volumeData.length;
            const markers = initialData
                .filter(d => d.volume > avgVolume * 4)
                .map(d => ({
                    time: d.time as Time,
                    position: 'aboveBar' as const,
                    color: '#E5FF00',
                    shape: 'arrowDown' as const,
                    text: 'WHALE_TX',
                }))
                // Markers MUST be strictly sorted by time ascending to prevent LW Charts crash
                .sort((a, b) => (a.time as number) - (b.time as number));

            seriesRef.current.setMarkers(markers);
        } catch (e) {
            console.error("LW_CHART_HYDRATION_ERROR: Invalid or Corrupted Time Series Data", e);
            // Non-fatal graceful degradation: Chart remains blank, app survives
        }
    }, [initialData]);



    useEffect(() => {
        if (seriesRef.current && realtimeData) {
            // OPTIMIZATION: Only "tick" the chart in real-time if we are on the 1S timeframe.
            // This prevents flickering and stability issues on higher timeframes (1m, 5m etc)
            // as requested by the user.
            if (timeframe !== '1S') return;

            try {
                // Ignore updating if the time is older than current series to prevent library crashes
                seriesRef.current.update({
                    time: realtimeData.time as Time,
                    open: realtimeData.open,
                    high: realtimeData.high,
                    low: realtimeData.low,
                    close: realtimeData.close,
                });
                if (volumeSeriesRef.current) {
                    volumeSeriesRef.current.update({
                        time: realtimeData.time as Time,
                        value: realtimeData.volume,
                        color: realtimeData.close >= realtimeData.open ? 'rgba(20, 241, 149, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                    });
                }

                // Update Indicators in real-time (v1 simplified: we wait for new candle typically)
                // But for a better user feel, we can re-calculate tail occasionally.
            } catch (err) {
                console.debug("Ignored out-of-order realtime tick update to preserve chart stability");
            }
        }
    }, [realtimeData, timeframe]);

    return (
        <div className="vortex-relative vortex-full-size vortex-chart-h">
            {/* Timeframe Selector HUD */}
            <div className="vortex-abs-top-right vortex-p-4 vortex-z-10 vortex-flex vortex-gap-2">
                {['1S', '1M', '5M', '15M', '1H', '1D'].map(tf => (
                    <button
                        key={tf}
                        className={`btn-vortex-mini ${tf === timeframe ? 'active text-vortex-yellow' : 'vortex-text-muted'} vortex-text-tiny`}
                        onClick={() => onTimeframeChange(tf as Timeframe)}
                    >
                        {tf}
                    </button>
                ))}
            </div>

            <div
                ref={chartContainerRef}
                className="vortex-full-size"
                role="img"
                aria-label="Interactive Token Price Chart"
            />

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
