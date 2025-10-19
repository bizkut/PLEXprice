import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, HistogramSeries, UTCTimestamp, LineSeries } from 'lightweight-charts';
import './PlexChart.css';

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
    const highestBuySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const lowestSellSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const [timeframe, setTimeframe] = useState('5M');
    const [isConnected, setIsConnected] = useState(false);
    const [allPlexData, setAllPlexData] = useState<PlexData[]>([]);
    const [iskAmount, setIskAmount] = useState<number | string>('');
    const [plexAmount, setPlexAmount] = useState<number | string>('');

    useEffect(() => {
        if (chartContainerRef.current) {
            chartRef.current = createChart(chartContainerRef.current, {
                width: chartContainerRef.current.clientWidth,
                height: 500,
                localization: {
                    priceFormatter: (price: number) => {
                        return price.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        });
                    },
                },
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

            highestBuySeriesRef.current = chartRef.current.addSeries(LineSeries, {
                color: '#26a69a',
                lineWidth: 2,
            });

            lowestSellSeriesRef.current = chartRef.current.addSeries(LineSeries, {
                color: '#ef5350',
                lineWidth: 2,
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
                const response = await fetch(`/historical-data/?window=1M`);
                const data: PlexData[] = await response.json();
                setAllPlexData(data);
            } catch (error) {
                console.error('Error fetching historical data:', error);
            }
        };

        fetchData();

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            const newData = JSON.parse(event.data);
            setAllPlexData(prevData => [...prevData, newData]);
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

        if (allPlexData.length === 0) {
            return;
        }

        // Sort by timestamp to ensure correct open/close values
        const sortedData = [...allPlexData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        let candleData;
        let volumeData;

        if (timeframe === '5M') {
            candleData = sortedData.map(item => ({
                time: (new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
                open: item.highest_buy,
                high: item.highest_buy,
                low: item.lowest_sell,
                close: item.lowest_sell,
            }));

            volumeData = sortedData.map((item, index) => {
                const prevItem = sortedData[index - 1] || item;
                const close = item.lowest_sell;
                const prevClose = prevItem.lowest_sell;
                return {
                    time: (new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
                    value: item.buy_volume + item.sell_volume,
                    color: close >= prevClose ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
                };
            });
        } else {
            ({ candleData, volumeData } = aggregateData(sortedData, timeframe));
        }

        const highestBuyData = candleData.map(item => ({ time: item.time, value: item.high }));
        const lowestSellData = candleData.map(item => ({ time: item.time, value: item.low }));

        if (candlestickSeriesRef.current) {
            candlestickSeriesRef.current.setData(candleData);
        }
        if (volumeSeriesRef.current) {
            volumeSeriesRef.current.setData(volumeData);
        }
        if (highestBuySeriesRef.current) {
            highestBuySeriesRef.current.setData(highestBuyData);
        }
        if (lowestSellSeriesRef.current) {
            lowestSellSeriesRef.current.setData(lowestSellData);
        }
    }, [timeframe, allPlexData]);

    const latestData = allPlexData.length > 0 ? allPlexData[allPlexData.length - 1] : null;
    const buyPrice = latestData ? latestData.highest_buy : 0;
    const sellPrice = latestData ? latestData.lowest_sell : 0;

    const formatIsk = (amount: number) => {
        return amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const handleIskChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/,/g, '');
        const amount = parseFloat(value);
        if (isNaN(amount)) {
            setIskAmount('');
            setPlexAmount('');
            return;
        }

        setIskAmount(amount.toLocaleString('en-US'));
        if (buyPrice > 0) {
            setPlexAmount(Math.floor(amount / buyPrice));
        }
    };

    const handlePlexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const amount = parseInt(e.target.value, 10);
        if (isNaN(amount)) {
            setPlexAmount('');
            setIskAmount('');
            return;
        }
        setPlexAmount(amount);
        if (sellPrice > 0) {
            setIskAmount(formatIsk(amount * sellPrice));
        }
    };

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
            <div className="calculator-container">
                <div className="calculator">
                    <label htmlFor="isk-input">ISK to PLEX</label>
                    <input
                        id="isk-input"
                        type="text"
                        value={iskAmount}
                        onChange={handleIskChange}
                        placeholder="Enter ISK amount"
                    />
                </div>
                <div className="calculator">
                    <label htmlFor="plex-input">PLEX to ISK</label>
                    <input
                        id="plex-input"
                        type="number"
                        value={plexAmount}
                        onChange={handlePlexChange}
                        placeholder="Enter PLEX amount"
                    />
                </div>
            </div>
        </div>
    );
};

export default PlexChart;