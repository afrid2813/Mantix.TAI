import React, { memo } from 'react';
import { cn } from '../lib/utils';

interface Order {
  price: number;
  qty: number;
}

export const OrderBook = memo(({ asks, bids }: { asks: Order[], bids: Order[] }) => {
  const maxAsk = asks.length ? Math.max(...asks.map(a => a.qty)) : 1;
  const maxBid = bids.length ? Math.max(...bids.map(b => b.qty)) : 1;

  return (
    <div className="grid grid-cols-2 gap-4 font-mono text-[10px]">
      {/* Asks (Sells) */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-gray-500 mb-1 px-1">
          <span>Price</span>
          <span>Qty</span>
        </div>
        {asks.map((ask, i) => (
          <div key={i} className="relative flex justify-between py-0.5 px-1 border-b border-border-dim/30 overflow-hidden">
            <div 
              className="absolute right-0 top-0 bottom-0 bg-brand-red/10 border-r border-brand-red/20 pointer-events-none" 
              style={{ width: `${(ask.qty / maxAsk) * 100}%` }}
            />
            <span className="text-brand-red z-10">{ask.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-gray-400 z-10">{ask.qty.toFixed(3)}</span>
          </div>
        ))}
      </div>

      {/* Bids (Buys) */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-gray-500 mb-1 px-1">
          <span>Price</span>
          <span>Qty</span>
        </div>
        {bids.map((bid, i) => (
          <div key={i} className="relative flex justify-between py-0.5 px-1 border-b border-border-dim/30 overflow-hidden">
            <div 
              className="absolute left-0 top-0 bottom-0 bg-brand-emerald/10 border-l border-brand-emerald/20 pointer-events-none" 
              style={{ width: `${(bid.qty / maxBid) * 100}%` }}
            />
            <span className="text-brand-emerald z-10">{bid.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-gray-400 z-10">{bid.qty.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
