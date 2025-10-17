import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';
import { format } from 'date-fns';

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
                    backgroundColor: '#1a1a1a',
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
                },
            });

            candlestickSeriesRef.current = chartRef.current.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderDownColor: '#ef5350',
                borderUpColor: '#26a69a',
                wickDownColor: '#ef5350',
                wickUpColor: '#26a69a',
            });

            volumeSeriesRef.current = chartRef.current.addHistogramSeries({
                color: '#26a69a',
                priceFormat: {
                    type: 'volume',
                },
                priceScaleId: 'volume_scale',
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
        const fetchData = async () => {
            try {
                const response = await fetch(`https://plex-api.gametrader.my/historical-data/?timeframe=${timeframe}`);
                const data: PlexData[] = await response.json();

                const candleData = data.map(item => ({
                    time: new Date(item.timestamp).getTime() / 1000,
                    open: item.highest_buy,
                    high: item.highest_buy,
                    low: item.lowest_sell,
                    close: item.lowest_sell,
                }));

                const volumeData = data.map(item => ({
                    time: new Date(item.timestamp).getTime() / 1000,
                    value: item.buy_volume + item.sell_volume,
                    color: item.highest_buy > item.lowest_sell ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
                }));

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
        const ws = new WebSocket(`wss://plex-api.gametrader.my/ws`);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            const newData = JSON.parse(event.data);
            const candleData = {
                time: new Date(newData.timestamp).getTime() / 1000,
                open: newData.highest_buy,
                high: newData.highest_buy,
                low: newData.lowest_sell,
                close: newData.lowest_sell,
            };
            const volumeData = {
                time: new Date(newData.timestamp).getTime() / 1000,
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