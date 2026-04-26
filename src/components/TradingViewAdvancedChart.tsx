import React, { memo } from 'react';
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

function TradingViewAdvancedChart({ symbol }: { symbol: string }) {
  const cleanSymbol = symbol.replace('USDT', '').toUpperCase();
  const formattedSymbol = symbol.toUpperCase().includes('USDT') ? `BINANCE:${cleanSymbol}USDT` : `NASDAQ:${cleanSymbol}`;

  return (
    <div className="h-full w-full" id="tv-adv-chart-container">
      <AdvancedRealTimeChart 
        theme="dark" 
        autosize 
        symbol={formattedSymbol}
        interval="1D"
        timezone="Etc/UTC"
        style="1"
        locale="en"
        enable_publishing={false}
        allow_symbol_change={true}
        calendar={false}
      />
    </div>
  );
}

export default memo(TradingViewAdvancedChart);
