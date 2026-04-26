import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { BollingerBands, SMA, EMA, MACD, RSI } from 'technicalindicators';
import { CandleData } from '../types';
import { detectAllSignals, SignalType } from '../lib/signals';
import { Settings, X } from 'lucide-react';

interface IndicatorConfig {
  smaVisible: boolean;
  smaPeriod: number;
  emaVisible: boolean;
  emaPeriod: number;
  bbVisible: boolean;
  bbPeriod: number;
  bbStdDev: number;
  macdVisible: boolean;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  rsiVisible: boolean;
  rsiPeriod: number;
}

const DEFAULT_CONFIG: IndicatorConfig = {
  smaVisible: false,
  smaPeriod: 20,
  emaVisible: true,
  emaPeriod: 20,
  bbVisible: true,
  bbPeriod: 20,
  bbStdDev: 2,
  macdVisible: true,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  rsiVisible: true,
  rsiPeriod: 14,
};

export function ChartWidget({ data }: { data: CandleData[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  
  const [config, setConfig] = useState<IndicatorConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  
  // Series refs
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const bbUpperRef = useRef<any>(null);
  const bbMiddleRef = useRef<any>(null);
  const bbLowerRef = useRef<any>(null);
  const macdHistRef = useRef<any>(null);
  const macdMacdRef = useRef<any>(null);
  const macdSignalRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);

  const resizeObserver = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#888780',
        fontFamily: '"JetBrains Mono", monospace',
      },
      grid: {
        vertLines: { color: 'rgba(136, 135, 128, 0.05)' },
        horzLines: { color: 'rgba(136, 135, 128, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(136, 135, 128, 0.15)',
        scaleMargins: {
          top: 0.05,
          bottom: 0.35, // leave room for volume + bottom indicators
        },
      },
      timeScale: {
        borderColor: 'rgba(136, 135, 128, 0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    
    chartRef.current = chart;

    // Candlestick Series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#00FF9D',
      downColor: '#FF3366',
      borderVisible: false,
      wickUpColor: '#00FF9D',
      wickDownColor: '#FF3366',
    });

    // Volume Series
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Overlay
    });
    volumeSeriesRef.current.priceScale().applyOptions({
      scaleMargins: {
        top: 0.65,
        bottom: 0.35, // sit right below chart
      },
    });

    // SMA
    smaSeriesRef.current = chart.addLineSeries({ color: '#FFD700', lineWidth: 2, title: 'SMA' });
    
    // EMA
    emaSeriesRef.current = chart.addLineSeries({ color: '#FF9800', lineWidth: 2, title: 'EMA' });

    // Bollinger Bands
    bbUpperRef.current = chart.addLineSeries({ color: 'rgba(54, 116, 217, 0.5)', lineWidth: 1, title: 'BB Upper' });
    bbMiddleRef.current = chart.addLineSeries({ color: 'rgba(255, 255, 255, 0.2)', lineWidth: 1, title: 'BB Middle' });
    bbLowerRef.current = chart.addLineSeries({ color: 'rgba(54, 116, 217, 0.5)', lineWidth: 1, title: 'BB Lower' });

    // MACD Histogram
    macdHistRef.current = chart.addHistogramSeries({ priceScaleId: 'macd', title: 'MACD Hist' });
    macdMacdRef.current = chart.addLineSeries({ color: '#2196F3', lineWidth: 1, priceScaleId: 'macd', title: 'MACD' });
    macdSignalRef.current = chart.addLineSeries({ color: '#FF9800', lineWidth: 1, priceScaleId: 'macd', title: 'Signal' });

    // MACD Price Scale
    chart.priceScale('macd').applyOptions({
      scaleMargins: {
        top: 0.65,
        bottom: 0.18,
      },
      visible: false, // hide scale numbers to save space or true
    });
    
    rsiSeriesRef.current = chart.addLineSeries({ color: '#9C27B0', lineWidth: 2, priceScaleId: 'rsi', title: 'RSI' });

    // RSI Price Scale
    chart.priceScale('rsi').applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0.0,
      },
      visible: false,
    });

    if (data.length > 0) {
      updateSeriesData(data, config);
    }

    resizeObserver.current = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });

    resizeObserver.current.observe(chartContainerRef.current);

    return () => {
      if (resizeObserver.current) resizeObserver.current.disconnect();
      chart.remove();
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when config or data changes
  useEffect(() => {
    if (chartRef.current && data.length > 0) {
      updateSeriesData(data, config);
    }
  }, [data, config]);

  const updateSeriesData = (rawCandles: CandleData[], currentConfig: IndicatorConfig) => {
    if (!candleSeriesRef.current || rawCandles.length === 0) return;

    // We recalculate everything fully to simplify interaction with config changes
    
    // Sort and deduplicate candles by time
    const uniqueCandlesMap = new Map();
    rawCandles.forEach(c => uniqueCandlesMap.set(c.time, c));
    const candles = Array.from(uniqueCandlesMap.values()).sort((a, b) => a.time - b.time);

    // 1. Candles
    candleSeriesRef.current.setData(candles as any);

    // 2. Volume
    const volumeData = candles.map(d => ({
      time: d.time as any,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(29, 158, 117, 0.3)' : 'rgba(226, 75, 74, 0.3)'
    }));
    volumeSeriesRef.current.setData(volumeData);

    const closes = candles.map(d => d.close);

    // 3. SMA
    if (currentConfig.smaVisible && closes.length >= currentConfig.smaPeriod) {
      const sma = SMA.calculate({ period: currentConfig.smaPeriod, values: closes });
      const offset = candles.length - sma.length;
      smaSeriesRef.current.setData(sma.map((val: any, i: number) => ({ time: candles[i + offset].time as any, value: val })));
    } else {
      smaSeriesRef.current.setData([]);
    }

    // 4. EMA
    if (currentConfig.emaVisible && closes.length >= currentConfig.emaPeriod) {
      const ema = EMA.calculate({ period: currentConfig.emaPeriod, values: closes });
      const offset = candles.length - ema.length;
      emaSeriesRef.current.setData(ema.map((val: any, i: number) => ({ time: candles[i + offset].time as any, value: val })));
    } else {
      emaSeriesRef.current.setData([]);
    }

    // 5. Bollinger Bands
    if (currentConfig.bbVisible && closes.length >= currentConfig.bbPeriod) {
      const bb = BollingerBands.calculate({ values: closes, period: currentConfig.bbPeriod, stdDev: currentConfig.bbStdDev });
      const offset = candles.length - bb.length;
      bbUpperRef.current.setData(bb.map((val: any, i: number) => ({ time: candles[i + offset].time as any, value: val.upper })));
      bbMiddleRef.current.setData(bb.map((val: any, i: number) => ({ time: candles[i + offset].time as any, value: val.middle })));
      bbLowerRef.current.setData(bb.map((val: any, i: number) => ({ time: candles[i + offset].time as any, value: val.lower })));
    } else {
      bbUpperRef.current.setData([]);
      bbMiddleRef.current.setData([]);
      bbLowerRef.current.setData([]);
    }

    // 6. MACD
    if (currentConfig.macdVisible && closes.length >= currentConfig.macdSlow) {
      const macd = MACD.calculate({
        values: closes,
        fastPeriod: currentConfig.macdFast,
        slowPeriod: currentConfig.macdSlow,
        signalPeriod: currentConfig.macdSignal,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });
      const offset = candles.length - macd.length;
      macdHistRef.current.setData(macd.map((val: any, i: number) => {
        const histValue = val.histogram || 0;
        return {
          time: candles[i + offset].time as any,
          value: histValue,
          color: histValue >= 0 ? '#00FF9D' : '#FF3366'
        };
      }));
      macdMacdRef.current.setData(macd.map((val: any, i: number) => ({ time: candles[i + offset].time as any, value: val.MACD || 0 })));
      macdSignalRef.current.setData(macd.map((val: any, i: number) => ({ time: candles[i + offset].time as any, value: val.signal || 0 })));
    } else {
      macdHistRef.current.setData([]);
      macdMacdRef.current.setData([]);
      macdSignalRef.current.setData([]);
    }

    // 7. RSI
    if (currentConfig.rsiVisible && closes.length >= currentConfig.rsiPeriod) {
      const rsi = RSI.calculate({ values: closes, period: currentConfig.rsiPeriod });
      const offset = candles.length - rsi.length;
      rsiSeriesRef.current.setData(rsi.map((val: any, i: number) => ({ time: candles[i + offset].time as any, value: val })));
    } else {
      rsiSeriesRef.current.setData([]);
    }

    // Signals
    const signals = detectAllSignals(candles);
    const markers = signals.map(s => ({
      time: s.time as any,
      position: s.type === SignalType.BUY ? 'belowBar' : 'aboveBar',
      color: s.type === SignalType.BUY ? '#00FF9D' : '#FF3366',
      shape: s.type === SignalType.BUY ? 'arrowUp' : 'arrowDown',
      text: s.type,
    }));
    candleSeriesRef.current.setMarkers(markers);
  };

  const handleConfigChange = (key: keyof IndicatorConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {/* Settings Toggle */}
      <button 
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 right-4 z-10 p-2 bg-brand-dark rounded-md border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        <Settings size={18} />
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-14 right-4 z-20 w-72 bg-brand-dark/95 backdrop-blur-md border border-gray-800 rounded-lg shadow-xl overflow-hidden shadow-black/50">
          <div className="flex justify-between items-center p-3 border-b border-gray-800 bg-black/40">
            <h3 className="text-sm font-semibold text-gray-200">Indicator Settings</h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          
          <div className="p-4 max-h-[400px] overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-gray-800">
            {/* SMA Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm text-gray-300">
                  <input type="checkbox" checked={config.smaVisible} onChange={e => handleConfigChange('smaVisible', e.target.checked)} className="rounded border-gray-700 bg-brand-dark text-brand-cyan focus:ring-brand-cyan/20" />
                  <span>SMA (Simple Moving Avg)</span>
                </label>
              </div>
              {config.smaVisible && (
                <div className="pl-6 flex items-center justify-between text-xs text-gray-400">
                  <span>Period</span>
                  <input type="number" value={config.smaPeriod} onChange={e => handleConfigChange('smaPeriod', parseInt(e.target.value) || 1)} className="w-16 bg-black border border-gray-800 rounded px-2 py-1 text-right focus:outline-none focus:border-brand-cyan" min={1} max={200} />
                </div>
              )}
            </div>

            {/* EMA Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm text-gray-300">
                  <input type="checkbox" checked={config.emaVisible} onChange={e => handleConfigChange('emaVisible', e.target.checked)} className="rounded border-gray-700 bg-brand-dark text-brand-cyan focus:ring-brand-cyan/20" />
                  <span>EMA (Exponential MA)</span>
                </label>
              </div>
              {config.emaVisible && (
                <div className="pl-6 flex items-center justify-between text-xs text-gray-400">
                  <span>Period</span>
                  <input type="number" value={config.emaPeriod} onChange={e => handleConfigChange('emaPeriod', parseInt(e.target.value) || 1)} className="w-16 bg-black border border-gray-800 rounded px-2 py-1 text-right focus:outline-none focus:border-brand-cyan" min={1} max={200} />
                </div>
              )}
            </div>

            {/* BB Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm text-gray-300">
                  <input type="checkbox" checked={config.bbVisible} onChange={e => handleConfigChange('bbVisible', e.target.checked)} className="rounded border-gray-700 bg-brand-dark text-brand-cyan focus:ring-brand-cyan/20" />
                  <span>Bollinger Bands</span>
                </label>
              </div>
              {config.bbVisible && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Period</span>
                    <input type="number" value={config.bbPeriod} onChange={e => handleConfigChange('bbPeriod', parseInt(e.target.value) || 1)} className="w-16 bg-black border border-gray-800 rounded px-2 py-1 text-right focus:outline-none focus:border-brand-cyan" min={1} max={200} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>StdDev</span>
                    <input type="number" value={config.bbStdDev} step={0.1} onChange={e => handleConfigChange('bbStdDev', parseFloat(e.target.value) || 1)} className="w-16 bg-black border border-gray-800 rounded px-2 py-1 text-right focus:outline-none focus:border-brand-cyan" min={0.1} max={10} />
                  </div>
                </div>
              )}
            </div>

            {/* MACD Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm text-gray-300">
                  <input type="checkbox" checked={config.macdVisible} onChange={e => handleConfigChange('macdVisible', e.target.checked)} className="rounded border-gray-700 bg-brand-dark text-brand-cyan focus:ring-brand-cyan/20" />
                  <span>MACD</span>
                </label>
              </div>
              {config.macdVisible && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Fast Period</span>
                    <input type="number" value={config.macdFast} onChange={e => handleConfigChange('macdFast', parseInt(e.target.value) || 1)} className="w-16 bg-black border border-gray-800 rounded px-2 py-1 text-right focus:outline-none focus:border-brand-cyan" min={1} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Slow Period</span>
                    <input type="number" value={config.macdSlow} onChange={e => handleConfigChange('macdSlow', parseInt(e.target.value) || 1)} className="w-16 bg-black border border-gray-800 rounded px-2 py-1 text-right focus:outline-none focus:border-brand-cyan" min={1} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Signal Period</span>
                    <input type="number" value={config.macdSignal} onChange={e => handleConfigChange('macdSignal', parseInt(e.target.value) || 1)} className="w-16 bg-black border border-gray-800 rounded px-2 py-1 text-right focus:outline-none focus:border-brand-cyan" min={1} />
                  </div>
                </div>
              )}
            </div>

            {/* RSI Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm text-gray-300">
                  <input type="checkbox" checked={config.rsiVisible} onChange={e => handleConfigChange('rsiVisible', e.target.checked)} className="rounded border-gray-700 bg-brand-dark text-brand-cyan focus:ring-brand-cyan/20" />
                  <span>RSI</span>
                </label>
              </div>
              {config.rsiVisible && (
                <div className="pl-6 flex items-center justify-between text-xs text-gray-400">
                  <span>Period</span>
                  <input type="number" value={config.rsiPeriod} onChange={e => handleConfigChange('rsiPeriod', parseInt(e.target.value) || 1)} className="w-16 bg-black border border-gray-800 rounded px-2 py-1 text-right focus:outline-none focus:border-brand-cyan" min={1} max={200} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actual Chart */}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
