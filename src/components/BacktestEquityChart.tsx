import { useEffect, useRef } from 'react';
import { createChart, ColorType, BaselineSeriesOptions } from 'lightweight-charts';

interface DataPoint {
  time: number;
  balance: number;
}

export function BacktestEquityChart({ data }: { data: DataPoint[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888780',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(136, 135, 128, 0.05)' },
      },
      timeScale: {
        visible: false,
      },
      rightPriceScale: {
         visible: false,
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addBaselineSeries({
      baseValue: { type: 'price', price: 10000 },
      topLineColor: '#00FF9D',
      topFillColor1: 'rgba(0, 255, 157, 0.2)',
      topFillColor2: 'rgba(0, 255, 157, 0.05)',
      bottomLineColor: '#FF3366',
      bottomFillColor1: 'rgba(255, 51, 102, 0.05)',
      bottomFillColor2: 'rgba(255, 51, 102, 0.2)',
      lineWidth: 2,
    });

    const formattedData = data.map(d => ({
      time: d.time as any,
      value: d.balance
    }));

    series.setData(formattedData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-24 mt-2" />;
}
