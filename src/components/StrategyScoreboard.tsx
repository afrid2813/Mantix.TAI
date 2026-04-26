import React from 'react';
import { cn } from '../lib/utils';

const strategies = [
  { name: 'RSI Divergence', wins: 247, total: 312, ret: 34.2, color: '#00FF9D' },
  { name: 'MACD Crossover', wins: 189, total: 301, ret: 22.1, color: '#00E5FF' },
  { name: 'Bollinger Bands', wins: 156, total: 244, ret: 18.7, color: '#7F77DD' },
  { name: 'EMA 50/200',     wins: 203, total: 280, ret: 28.5, color: '#EF9F27' },
  { name: 'Momentum',       wins: 312, total: 398, ret: 41.8, color: '#00FF9D' },
  { name: 'Mean Reversion', wins: 77,  total: 189, ret: 7.2,  color: '#FF3366' },
  { name: 'Breakout',       wins: 134, total: 210, ret: 19.4, color: '#00E5FF' },
];

export function StrategyScoreboard() {
  const sorted = [...strategies].sort((a, b) => b.ret - a.ret);

  return (
    <div className="flex flex-col gap-3 font-mono">
      {sorted.map((s, i) => {
        const wr = Math.round((s.wins / s.total) * 100);
        const status = wr >= 65 ? 'STRONG' : wr >= 50 ? 'NEUTRAL' : 'WEAK';
        const statusColor = wr >= 65 ? 'text-brand-emerald bg-brand-emerald/10' : wr >= 50 ? 'text-blue-400 bg-blue-400/10' : 'text-brand-red bg-brand-red/10';

        return (
          <div key={i} className="flex items-center gap-3 text-[11px] group cursor-default">
            <span className="w-24 shrink-0 text-white truncate">{s.name}</span>
            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0", statusColor)}>
              {status}
            </span>
            <div className="flex-1 h-1 bg-border-dim overflow-hidden rounded-full self-center">
              <div 
                className="h-full rounded-full transition-all duration-1000" 
                style={{ width: `${Math.round(s.ret / 45 * 100)}%`, backgroundColor: s.color }}
              />
            </div>
            <span className="w-10 text-right font-bold" style={{ color: s.color }}>+{s.ret}%</span>
            <span className="w-12 text-right text-gray-500 text-[9px]">{s.wins}/{s.total}</span>
          </div>
        );
      })}
    </div>
  );
}
