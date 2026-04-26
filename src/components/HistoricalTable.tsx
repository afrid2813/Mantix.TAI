import React, { memo } from 'react';
import { format } from 'date-fns';
import { CandleData } from '../types';

export const HistoricalTable = memo(({ data }: { data: CandleData[] }) => {
  const reversedData = React.useMemo(() => [...data].reverse().slice(0, 40), [data]);

  const stats = React.useMemo(() => {
    if (data.length === 0) return null;
    return {
      high: Math.max(...data.map(d => d.high)),
      low: Math.min(...data.map(d => d.low)),
      totalVolume: data.reduce((acc, d) => acc + d.volume, 0),
      avgClose: data.reduce((acc, d) => acc + d.close, 0) / data.length
    };
  }, [data]);

  return (
    <div className="flex flex-col h-full font-mono">
      {stats && (
        <div className="grid grid-cols-2 gap-px bg-border-dim/30 border-b border-border-dim/50">
          <div className="p-2 bg-bg-secondary/20">
            <div className="text-[8px] text-gray-500 uppercase tracking-tighter">Range High</div>
            <div className="text-[11px] font-bold text-brand-emerald">${stats.high.toLocaleString()}</div>
          </div>
          <div className="p-2 bg-bg-secondary/20 border-l border-border-dim/30">
            <div className="text-[8px] text-gray-500 uppercase tracking-tighter">Range Low</div>
            <div className="text-[11px] font-bold text-brand-red">${stats.low.toLocaleString()}</div>
          </div>
          <div className="p-2 bg-bg-secondary/20 border-t border-border-dim/30">
            <div className="text-[8px] text-gray-500 uppercase tracking-tighter">Total Vol</div>
            <div className="text-[11px] font-bold text-gray-300">{stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="p-2 bg-bg-secondary/20 border-t border-l border-border-dim/30">
            <div className="text-[8px] text-gray-500 uppercase tracking-tighter">Avg Close</div>
            <div className="text-[11px] font-bold text-gray-300">${stats.avgClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-border-dim/50 bg-bg-secondary/40 text-[9px] font-bold text-gray-500 uppercase tracking-widest shrink-0">
        <span>Time</span>
        <span className="text-right">Open</span>
        <span className="text-right">High</span>
        <span className="text-right">Low</span>
        <span className="text-right">Close</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {reversedData.length === 0 ? (
          <div className="p-8 text-center text-gray-600 text-[10px] uppercase tracking-widest">
            No historical data loaded
          </div>
        ) : (
          reversedData.map((candle, i) => (
            <div 
              key={candle.time} 
              className="grid grid-cols-5 gap-2 px-4 py-1.5 border-b border-border-dim/20 text-[10px] hover:bg-white/5 transition-colors"
            >
              <span className="text-gray-500">
                {format(new Date(candle.time * 1000), 'MM/dd HH:mm')}
              </span>
              <span className="text-right text-gray-300">
                {candle.open.toLocaleString(undefined, { minimumFractionDigits: 1 })}
              </span>
              <span className="text-right text-brand-emerald/80">
                {candle.high.toLocaleString(undefined, { minimumFractionDigits: 1 })}
              </span>
              <span className="text-right text-brand-red/80">
                {candle.low.toLocaleString(undefined, { minimumFractionDigits: 1 })}
              </span>
              <span className="text-right font-bold text-white">
                {candle.close.toLocaleString(undefined, { minimumFractionDigits: 1 })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
