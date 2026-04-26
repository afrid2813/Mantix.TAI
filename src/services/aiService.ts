import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || '';
const hasApiKey = apiKey.length > 5 && !apiKey.includes('undefined');
const ai = hasApiKey ? new GoogleGenAI({ apiKey }) : null;

export interface AIResult {
  prediction: string;
  confidence: number;
  provider: string;
}

export async function getGeminiPrediction(data: {
  symbol: string;
  recentPrice: number;
  rsi: number;
  macd: { macdLine: number; signalLine: number; hist: number };
  sma: { sma20: number; sma50: number };
  bb: { upper: number; lower: number; middle: number };
  stoch: { k: number; d: number };
  volatility: number;
  volume: number;
  change24h: number;
  newsSentiment?: { score: number; label: string; summary: string };
}): Promise<AIResult> {
  if (!ai) {
     console.warn('Gemini API key missing or invalid, using computational fallback');
     return getComputationalPrediction(data);
  }

  const prompt = `You are an advanced multi-layer AI trading engine designed for high-performance execution and adaptive learning.
Your goal is to maximize risk-adjusted returns while preserving capital.

SYSTEM STRUCTURE:
- Combine trend, momentum, order book, and volatility analysis
- Use consensus-based decision making (not single indicator)

SIGNAL RULES:
- Trade only when multiple confirmations align
- Detect and avoid fake breakouts using volume + liquidity
- Default to HOLD unless strong probability exists

EXECUTION:
- Optimize for speed and precision
- Use market orders only in strong momentum
- Use limit orders in stable conditions

RISK MANAGEMENT:
- Risk per trade <= 1%
- Risk:Reward >= 1:2
- Enforce daily loss limit
- Always define stop-loss before entry

ORDER BOOK INTELLIGENCE:
- Detect liquidity walls and traps
- Avoid trades against strong opposing liquidity

SELF-LEARNING:
- Continuously learn from past trades
- Reduce repeated mistakes
- Adapt thresholds dynamically

Contextual Data:
- Symbol: ${data.symbol}
- Price: $${data.recentPrice} (${data.change24h}% 24h)
- Momentum: RSI ${data.rsi.toFixed(1)}, MACD Hist ${data.macd.hist.toFixed(4)}
- Trend: SMA20 $${data.sma.sma20.toFixed(2)}, SMA50 $${data.sma.sma50.toFixed(2)}
- Volatility: ${data.volatility.toFixed(2)}%, BB Width: ${(data.bb.upper - data.bb.lower).toFixed(2)}
- External Sentiment: ${data.newsSentiment?.label || 'Neutral'} (${data.newsSentiment?.summary || 'N/A'})

FINAL RULE:
- No trade is better than a bad trade
- Survival first, profit second

Output JSON:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, description: "BUY | SELL | HOLD" },
            confidence: { type: Type.NUMBER, description: "0-100" },
            entry_price: { type: Type.NUMBER },
            stop_loss: { type: Type.NUMBER },
            take_profit: { type: Type.NUMBER },
            position_size: { type: Type.NUMBER },
            reason: { type: Type.STRING, description: "short explanation" }
          },
          required: ["action", "confidence", "entry_price", "stop_loss", "take_profit", "position_size", "reason"]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      prediction: JSON.stringify(parsed, null, 2),
      confidence: parsed.confidence,
      provider: 'Gemini Execution Engine'
    };
  } catch (error: any) {
    console.error('Gemini Prediction Failed:', error.message);
    throw new Error(error.message || 'AI Engine failed to generate analysis.');
  }
}

export async function getNewsSentiment(news: { title: string }[]) {
  if (!ai) {
    return { score: 0, summary: "Sentiment analysis unavailable (API key missing)", label: "Neutral", impactDrivers: [] };
  }
  const newsTitles = news.map(n => `- ${n.title}`).join('\n');
  const prompt = `Perform multi-source NLP sentiment synthesis on these headlines:
${newsTitles}

Analyze for:
1. Macro Trend Impact
2. Social/Retail Hype vs Institutional Signal
3. Dominant Emotion (Fear, Greed, Uncertainty, Optimism)

Output JSON: score (-1 to 1), summary (string), label (string), impactDrivers (string array).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            label: { type: Type.STRING },
            impactDrivers: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["score", "summary", "label", "impactDrivers"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return { score: 0, summary: "Sentiment analysis hitting rate limits (Quota Exceeded)", label: "Neutral", impactDrivers: ["Quota Limit Reached"] };
    }
    if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
      console.warn('Gemini Sentiment API 500 Error - using neutral sentiment');
      return { score: 0, summary: "Sentiment analysis hitting API errors", label: "Neutral", impactDrivers: ["API Error"] };
    }
    console.error('Gemini Sentiment Error:', error.message);
    return { score: 0, summary: "Sentiment analysis failed", label: "Neutral", impactDrivers: [] };
  }
}

export function getComputationalPrediction(data: any): AIResult {
  let score = 0;
  const analysisPoints: string[] = [];

  // Trend Analysis (Moving Averages)
  if (data.recentPrice > data.sma.sma20 && data.sma.sma20 > data.sma.sma50) {
    score += 2;
    analysisPoints.push("Ascending SMA alignment (Golden Cross pattern)");
  } else if (data.recentPrice < data.sma.sma20 && data.sma.sma20 < data.sma.sma50) {
    score -= 2;
    analysisPoints.push("Descending SMA alignment (Death Cross pattern)");
  } else if (data.recentPrice > data.sma.sma20) {
    score += 1;
    analysisPoints.push("Price over 20-period SMA");
  } else {
    score -= 1;
    analysisPoints.push("Price under 20-period SMA");
  }

  // Momentum Analysis
  if (data.rsi < 30) {
    score += 3;
    analysisPoints.push(`Strong oversold conditions (RSI: ${data.rsi.toFixed(1)})`);
  } else if (data.rsi > 70) {
    score -= 3;
    analysisPoints.push(`Overbought conditions forming (RSI: ${data.rsi.toFixed(1)})`);
  } else if (data.rsi > 50) {
    score += 1;
    analysisPoints.push("Positive momentum bias");
  } else {
    score -= 1;
    analysisPoints.push("Negative momentum bias");
  }

  // MACD Divergence / Histogram
  if (data.macd.hist > 0 && data.macd.macdLine > data.macd.signalLine) {
    score += 2;
    analysisPoints.push("MACD histogram expanding positively");
  } else if (data.macd.hist < 0 && data.macd.macdLine < data.macd.signalLine) {
    score -= 2;
    analysisPoints.push("MACD histogram expanding negatively");
  }

  // Bollinger Bands
  if (data.recentPrice < data.bb.lower) {
    score += 1.5;
    analysisPoints.push("Price piercing lower Bollinger Band (Mean reversion target)");
  } else if (data.recentPrice > data.bb.upper) {
    score -= 1.5;
    analysisPoints.push("Price piercing upper Bollinger Band (Possible exhaustion)");
  }

  // Normalize score
  let bias = 'NEUTRAL';
  let conf = 50 + Math.abs(score) * 5;
  if (conf > 95) conf = 95;

  if (score >= 4) bias = 'STRONG BULLISH';
  else if (score >= 1.5) bias = 'BULLISH';
  else if (score <= -4) bias = 'STRONG BEARISH';
  else if (score <= -1.5) bias = 'BEARISH';

  const analysis = analysisPoints.join('. ');
  const driver = analysisPoints.length > 0 ? analysisPoints[0] : "Mixed signals";

  const resultJSON = {
    action: bias === 'STRONG BULLISH' || bias === 'BULLISH' ? 'BUY' : bias === 'STRONG BEARISH' || bias === 'BEARISH' ? 'SELL' : 'HOLD',
    confidence: conf,
    entry_price: data.recentPrice,
    stop_loss: bias.includes('BULLISH') ? data.recentPrice * 0.98 : data.recentPrice * 1.02,
    take_profit: bias.includes('BULLISH') ? data.recentPrice * 1.06 : data.recentPrice * 0.94,
    position_size: 100, // mock fallback
    reason: driver
  };

  return {
    prediction: JSON.stringify(resultJSON, null, 2),
    confidence: conf,
    provider: 'Local Quant Engine'
  };
}
