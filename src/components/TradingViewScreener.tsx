import React, { memo } from 'react';
import { Screener } from "react-ts-tradingview-widgets";

function TradingViewScreener() {
  return (
    <div className="h-full w-full">
      <Screener 
        colorTheme="dark" 
        width="100%" 
        height="100%" 
        defaultColumn="overview" 
        defaultScreen="general" 
        market="crypto" 
        showToolbar={true} 
      />
    </div>
  );
}

export default memo(TradingViewScreener);
