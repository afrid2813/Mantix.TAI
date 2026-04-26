import { CandleData } from '../types';
import { RSI, MACD, BollingerBands } from 'technicalindicators';

export type BacktestStrategy = 'rsi' | 'macd' | 'bb' | 'rsi_macd';

export function runBacktest(data: CandleData[], strategy: BacktestStrategy = 'rsi') {
  if (data.length < 50) return { error: "Insufficient data for backtest (minimum 50 candles)" };

  const closes = data.map(d => d.close);
  const rsi = RSI.calculate({ values: closes, period: 14 });
  const macd = MACD.calculate({ 
    values: closes, 
    fastPeriod: 12, 
    slowPeriod: 26, 
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false 
  });
  const bb = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });

  let balance = 10000;
  let position = 0;
  let trades = 0;
  let wins = 0;

  let lastBuyPrice = 0;
  const equityHistory: { time: number, balance: number }[] = [];

  // Align start offsets based on longest indicator
  const startIndex = 26; // MACD needs 26

  for (let i = startIndex; i < closes.length; i++) {
    const currentPrice = closes[i];
    const timestamp = data[i].time;
    
    const rsiIdx = i - 14; 
    const macdIdx = i - 26; // Approx alignment
    const bbIdx = i - 20;

    let buySignal = false;
    let sellSignal = false;

    if (strategy === 'rsi') {
      const currentRsi = rsi[rsiIdx];
      buySignal = currentRsi < 33;
      sellSignal = currentRsi > 67;
    } else if (strategy === 'macd') {
      const currentMacd = macd[macdIdx];
      const prevMacd = macd[macdIdx - 1];
      if (currentMacd && prevMacd) {
        buySignal = (prevMacd.MACD as number) <= (prevMacd.signal as number) && (currentMacd.MACD as number) > (currentMacd.signal as number);
        sellSignal = (prevMacd.MACD as number) >= (prevMacd.signal as number) && (currentMacd.MACD as number) < (currentMacd.signal as number);
      }
    } else if (strategy === 'bb') {
      const currentBb = bb[bbIdx];
      if (currentBb) {
        buySignal = currentPrice < currentBb.lower;
        sellSignal = currentPrice > currentBb.upper;
      }
    } else if (strategy === 'rsi_macd') {
      const currentRsi = rsi[rsiIdx];
      const currentMacd = macd[macdIdx];
      const prevMacd = macd[macdIdx - 1];
      if (currentRsi && currentMacd && prevMacd) {
        const macdCrossUp = (prevMacd.MACD as number) <= (prevMacd.signal as number) && (currentMacd.MACD as number) > (currentMacd.signal as number);
        const macdCrossDown = (prevMacd.MACD as number) >= (prevMacd.signal as number) && (currentMacd.MACD as number) < (currentMacd.signal as number);
        buySignal = currentRsi < 40 && macdCrossUp;
        sellSignal = currentRsi > 70 || macdCrossDown;
      }
    }

    if (buySignal && position === 0) {
      position = balance / currentPrice;
      lastBuyPrice = currentPrice;
      balance = 0;
      trades++;
    } else if (sellSignal && position > 0) {
      const saleValue = position * currentPrice;
      if (currentPrice > lastBuyPrice) wins++;
      balance = saleValue;
      position = 0;
    }

    const currentEquity = position > 0 ? position * currentPrice : balance;
    equityHistory.push({ time: timestamp, balance: currentEquity });
  }

  const finalValue = position > 0 ? position * closes[closes.length - 1] : balance;
  const pnl = ((finalValue - 10000) / 10000) * 100;

  let strategyName = 'RSI (14) Mean Reversion';
  if (strategy === 'macd') strategyName = 'MACD Crossover (12, 26, 9)';
  else if (strategy === 'bb') strategyName = 'Bollinger Bands Mean Reversion (20, 2)';
  else if (strategy === 'rsi_macd') strategyName = 'RSI + MACD Confluence';

  return {
    initialBalance: 10000,
    finalBalance: finalValue,
    pnl: pnl.toFixed(2),
    trades,
    winRate: trades > 0 ? ((wins / trades) * 100).toFixed(1) : 0,
    equityHistory,
    strategyName
  };
}
