import { CandleData } from '../types';
import { calculateIndicators } from './indicators';

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  NEUTRAL = 'NEUTRAL'
}

export interface StrategySignal {
  type: SignalType;
  reason: string;
  timestamp: number;
}

export function detectAllSignals(marketData: CandleData[]): (StrategySignal & { time: number })[] {
  const allSignals: (StrategySignal & { time: number })[] = [];
  if (marketData.length < 20) return []; // Need enough data for indicators

  // We need to calculate indicators for each point
  // For performance in a real app, we'd use a rolling window
  // Here we'll just do it for the last 50 points to avoid blocking
  const windowSize = Math.min(marketData.length, 100);
  
  for (let i = marketData.length - windowSize; i < marketData.length; i++) {
    const historicalSlice = marketData.slice(0, i + 1);
    const historicalIndicators = calculateIndicators(historicalSlice, true); // true for fast/subset calculation
    if (!historicalIndicators) continue;

    const sig = detectSignal(historicalIndicators, historicalSlice);
    if (sig.type !== SignalType.NEUTRAL) {
      allSignals.push({ ...sig, time: marketData[i].time });
    }
  }

  return allSignals;
}

export function detectSignal(indicators: any, marketData: CandleData[]): StrategySignal {
  if (!indicators || marketData.length < 2) {
    return { type: SignalType.NEUTRAL, reason: 'Insufficient data', timestamp: Date.now() };
  }

  const latestCandle = marketData[marketData.length - 1];
  const { rsi, macd, stoch, bb, sma } = indicators;

  // 1. Oversold Reversal (Moderate Sensitivity)
  if (rsi < 35 && stoch.k < 30 && macd.hist > -1 && latestCandle.close <= bb.lower * 1.01) {
    return {
      type: SignalType.BUY,
      reason: `Bullish Reversal: RSI Oversold (${rsi.toFixed(1)}) and Price at Lower BB Support.`,
      timestamp: latestCandle.time * 1000
    };
  }

  // 2. Overbought Rejection (Moderate Sensitivity)
  if (rsi > 65 && stoch.k > 70 && macd.hist < 1 && latestCandle.close >= bb.upper * 0.99) {
    return {
      type: SignalType.SELL,
      reason: `Bearish Rejection: RSI Overbought (${rsi.toFixed(1)}) and Price at Upper BB Resistance.`,
      timestamp: latestCandle.time * 1000
    };
  }

  // 3. Trend Continuation
  if (sma && sma.sma20 > sma.sma50 && macd.macdLine > macd.signalLine && rsi > 45 && rsi < 65) {
      return {
          type: SignalType.BUY,
          reason: `Trend Following: Strong Golden Cross and Positive MACD Momentum.`,
          timestamp: latestCandle.time * 1000
      };
  }

  if (sma && sma.sma20 < sma.sma50 && macd.macdLine < macd.signalLine && rsi < 55 && rsi > 35) {
      return {
          type: SignalType.SELL,
          reason: `Trend Breakdown: Death Cross confirmed by Bearish Momentum.`,
          timestamp: latestCandle.time * 1000
      };
  }

  return { type: SignalType.NEUTRAL, reason: 'Market consolidation', timestamp: Date.now() };
}
