import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, HistogramSeries, UTCTimestamp } from 'lightweight-charts';

interface PlexData {
    timestamp: string;
    highest_buy: number;
    lowest_sell: number;
    buy_volume: number;
    sell_volume: number;
}

const PlexChart: React.FC = () => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const [timeframe, setTimeframe] = useState('1D');
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (chartContainerRef.current) {
            chartRef.current = createChart(chartContainerRef.current, {
                width: chartContainerRef.current.clientWidth,
                height: 500,
                layout: {
                    background: {
                        color: '#1a1a1a',
                    },
                    textColor: '#d1d4dc',
                },
                grid: {
                    vertLines: {
                        color: 'rgba(42, 46, 57, 0.5)',
                    },
                    horzLines: {
                        color: 'rgba(42, 46, 57, 0.5)',
                    },
                },
                timeScale: {
                    borderColor: 'rgba(197, 203, 206, 0.8)',
                    timeVisible: true,
                    secondsVisible: false,
                },
            });

            candlestickSeriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderDownColor: '#ef5350',
                borderUpColor: '#26a69a',
                wickDownColor: '#ef5350',
                wickUpColor: '#26a69a',
            });

            volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
                color: '#26a69a',
                priceFormat: {
                    type: 'volume',
                },
                priceScaleId: 'volume_scale',
            });
            volumeSeriesRef.current.priceScale().applyOptions({
                scaleMargins: {
                    top: 0.8,
                    bottom: 0,
                },
            });
        }

        return () => {
            if (chartRef.current) {
                chartRef.current.remove();
            }
        };
    }, []);

    useEffect(() => {
        const aggregateData = (data: PlexData[], timeframe: string) => {
            const aggregatedData = new Map<number, {
                open: number;
                high: number;
                low: number;
                close: number;
                volume: number;
            }>();

            const getTimestamp = (date: Date) => {
                const d = new Date(date);
                if (timeframe === '1H') {
                    d.setMinutes(0, 0, 0);
                } else if (timeframe === '1D') {
                    d.setHours(0, 0, 0, 0);
                } else if (timeframe === '1W') {
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                    d.setDate(diff);
                    d.setHours(0, 0, 0, 0);
                } else if (timeframe === '1M') {
                    d.setDate(1);
                    d.setHours(0, 0, 0, 0);
                }
                return d.getTime() / 1000;
            };

            data.forEach(item => {
                const timestamp = getTimestamp(new Date(item.timestamp));
                const existing = aggregatedData.get(timestamp);

                if (existing) {
                    existing.high = Math.max(existing.high, item.highest_buy);
                    existing.low = Math.min(existing.low, item.lowest_sell);
                    existing.close = item.lowest_sell;
                    existing.volume += item.buy_volume + item.sell_volume;
                } else {
                    aggregatedData.set(timestamp, {
                        open: item.highest_buy,
                        high: item.highest_buy,
                        low: item.lowest_sell,
                        close: item.lowest_sell,
                        volume: item.buy_volume + item.sell_volume,
                    });
                }
            });

            const candleData = Array.from(aggregatedData.entries()).map(([timestamp, values]) => ({
                time: timestamp as UTCTimestamp,
                open: values.open,
                high: values.high,
                low: values.low,
                close: values.close,
            }));

            const volumeData = Array.from(aggregatedData.entries()).map(([timestamp, values]) => ({
                time: timestamp as UTCTimestamp,
                value: values.volume,
                color: values.open > values.close ? 'rgba(239, 83, 80, 0.5)' : 'rgba(38, 166, 154, 0.5)',
            }));

            return { candleData, volumeData };
        };

        const fetchData = async () => {
            try {
                // Always fetch the last month of data
                const response = await fetch(`/historical-data/?timeframe=1M`);
                const data: PlexData[] = await response.json();

                // Sort by timestamp to ensure correct open/close values
                data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                let candleData;
                let volumeData;

                if (timeframe === '5M') {
                    candleData = data.map(item => ({
                        time: (new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
                        open: item.highest_buy,
                        high: item.highest_buy,
                        low: item.lowest_sell,
                        close: item.lowest_sell,
                    }));

                    volumeData = data.map(item => ({
                        time: (new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
                        value: item.buy_volume + item.sell_volume,
                        color: item.highest_buy > item.lowest_sell ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
                    }));
                } else {
                    ({ candleData, volumeData } = aggregateData(data, timeframe));
                }

                if (candlestickSeriesRef.current) {
                    candlestickSeriesRef.current.setData(candleData);
                }
                if (volumeSeriesRef.current) {
                    volumeSeriesRef.current.setData(volumeData);
                }

            } catch (error) {
                console.error('Error fetching historical data:', error);
            }
        };

        fetchData();
    }, [timeframe]);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            const newData = JSON.parse(event.data);
            const candleData = {
                time: (new Date(newData.timestamp).getTime() / 1000) as UTCTimestamp,
                open: newData.highest_buy,
                high: newData.highest_buy,
                low: newData.lowest_sell,
                close: newData.lowest_sell,
            };
            const volumeData = {
                time: (new Date(newData.timestamp).getTime() / 1000) as UTCTimestamp,
                value: newData.buy_volume + newData.sell_volume,
                color: newData.highest_buy > newData.lowest_sell ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
            };

            if (candlestickSeriesRef.current) {
                candlestickSeriesRef.current.update(candleData);
            }
            if (volumeSeriesRef.current) {
                volumeSeriesRef.current.update(volumeData);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        return () => {
            ws.close();
        };
    }, []);

    return (
        <div>
            <div>
                <button onClick={() => setTimeframe('5M')}>5M</button>
                <button onClick={() => setTimeframe('1H')}>1H</button>
                <button onClick={() => setTimeframe('1D')}>1D</button>
                <button onClick={() => setTimeframe('1W')}>1W</button>
                <button onClick={() => setTimeframe('1M')}>1M</button>
                <span style={{ marginLeft: '20px', color: isConnected ? '#26a69a' : '#ef5350' }}>
                    {isConnected ? '● Connected' : '● Disconnected'}
                </span>
            </div>
            <div ref={chartContainerRef} style={{ marginTop: '20px' }} />
        </div>
    );
};

export default PlexChart;