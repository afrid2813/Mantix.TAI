import React from 'react';
import { Activity, TrendingUp, LineChart } from 'lucide-react';
import { cn } from '../lib/utils';

interface IndicatorProps {
  label: string;
  value: number;
  subValue?: string;
  status: 'bullish' | 'bearish' | 'neutral';
  icon: React.ReactNode;
}

export function IndicatorCard({ label, value, subValue, status, icon }: IndicatorProps) {
  return (
    <div className="glass-panel p-3 hover:border-gray-500/50 transition-colors cursor-default flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-gray-500 text-[9px] font-bold tracking-wider uppercase truncate pr-2">{label}</h3>
        <div className="text-gray-500/80 scale-75 origin-right">
          {icon}
        </div>
      </div>
      
      <div className="flex items-baseline justify-between gap-1 flex-wrap">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-mono font-bold text-white tracking-tighter leading-none">{value}</span>
          {subValue && <span className="text-[9px] font-mono text-gray-500/80 truncate max-w-[60px]">{subValue}</span>}
        </div>
        
        <div className={cn(
          "text-[8px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded leading-none",
          status === 'bullish' ? "bg-brand-emerald/10 text-brand-emerald" :
          status === 'bearish' ? "bg-brand-red/10 text-brand-red" :
          "bg-gray-800 text-gray-400"
        )}>
          {status}
        </div>
      </div>
    </div>
  );
}
