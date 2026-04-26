import { RSI, MACD, SMA, BollingerBands, Stochastic } from 'technicalindicators';
import { CandleData } from '../types';

export function calculateIndicators(data: CandleData[], fast: boolean = false) {
  if (data.length === 0) return null;

  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);
  
  if (closes.length < 14) return null; // Relaxed for markers

  // RSI
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const currentRSI = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 0;

  // MACD
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const currentMACD = macdValues.length > 0 ? macdValues[macdValues.length - 1] : { MACD: 0, signal: 0, histogram: 0 };

  // SMAs
  const sma20Values = SMA.calculate({ values: closes, period: 20 });
  const sma50Values = SMA.calculate({ values: closes, period: 50 });
  const currentSMA20 = sma20Values.length > 0 ? sma20Values[sma20Values.length - 1] : 0;
  const currentSMA50 = sma50Values.length > 0 ? sma50Values[sma50Values.length - 1] : 0;

  // Bollinger Bands
  const bbValues = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const currentBB = bbValues.length > 0 ? bbValues[bbValues.length - 1] : { upper: 0, middle: 0, lower: 0 };

  // Stochastic
  const stochValues = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3
  });
  const currentStoch = stochValues.length > 0 ? stochValues[stochValues.length - 1] : { k: 0, d: 0 };

  // Volatility (Standard Deviation of last 20 returns)
  let volatility = 0;
  if (closes.length >= 21) {
    const returns = [];
    for (let i = closes.length - 20; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    volatility = Math.sqrt(variance) * 100 * Math.sqrt(365); // Annualized % approx
  }

  const currentVolume = volumes[volumes.length - 1];

  return {
    rsi: Number((currentRSI || 0).toFixed(2)),
    macd: {
      macdLine: Number(currentMACD.MACD?.toFixed(2) || 0),
      signalLine: Number(currentMACD.signal?.toFixed(2) || 0),
      hist: Number(currentMACD.histogram?.toFixed(2) || 0)
    },
    sma: {
      sma20: Number((currentSMA20 || 0).toFixed(2)),
      sma50: Number((currentSMA50 || 0).toFixed(2))
    },
    bb: {
      upper: Number(currentBB.upper?.toFixed(2) || 0),
      lower: Number(currentBB.lower?.toFixed(2) || 0),
      middle: Number(currentBB.middle?.toFixed(2) || 0)
    },
    stoch: {
      k: Number(currentStoch.k?.toFixed(2) || 0),
      d: Number(currentStoch.d?.toFixed(2) || 0)
    },
    volatility: Number((volatility || 0).toFixed(2)),
    volume: currentVolume || 0
  };
}
