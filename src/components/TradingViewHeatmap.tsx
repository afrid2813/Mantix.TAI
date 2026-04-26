import React, { memo } from 'react';
import { CryptoCoinsHeatmap } from "react-ts-tradingview-widgets";

function TradingViewHeatmap() {
  return (
    <div className="h-full w-full">
      <CryptoCoinsHeatmap 
        colorTheme="dark" 
        width="100%" 
        height="100%" 
        hasTopBar={false}
        isDataSetEnabled={false}
        isZoomEnabled={true}
        hasSymbolTooltip={true}
      />
    </div>
  );
}

export default memo(TradingViewHeatmap);
