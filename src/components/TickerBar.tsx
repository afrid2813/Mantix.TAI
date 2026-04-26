import React, { memo } from 'react';
import { cn } from '../lib/utils';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

export const TickerBar = memo(({ data }: { data: Record<string, TickerItem> }) => {
  const items = Object.values(data);

  return (
    <div className="flex gap-8 overflow-x-auto py-2 border-y border-border-dim scrollbar-none no-scrollbar">
      {items.length === 0 ? (
        <span className="text-[11px] text-gray-500 font-mono italic">Initializing market tickers...</span>
      ) : (
        items.map((item) => (
          <div key={item.symbol} className="flex gap-2 items-center whitespace-nowrap text-xs shrink-0 group">
            <span className="font-bold text-white group-hover:text-brand-emerald transition-colors">
              {item.symbol.replace('USDT', '')}
            </span>
            <span className="font-mono text-gray-400">
              ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
            <span className={cn(
              "font-mono text-[10px]",
              item.change >= 0 ? "text-brand-emerald" : "text-brand-red"
            )}>
              {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
            </span>
          </div>
        ))
      )}
    </div>
  );
});
