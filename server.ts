import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import NodeCache from 'node-cache';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import tradeRoute from './routes/trade';
import accountRoute from './routes/account';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Using Native Node 22.14 TS support -> NO ENUMS here
const cache = new NodeCache({ stdTTL: 5 }); // 5 seconds cache

// Rate Limiting Setup
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Very high limit: UI polls frequently
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    trustProxy: false,
  }
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = parseInt(process.env.PORT || '3000');

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for development/vite compatibility. In true production, configure strictly.
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  
  // Apply rate limiter to /api routes
// app.use('/api/', apiLimiter);

  // Init AI clients lazily
  let anthropicClient: Anthropic | null = null;

  function getAnthropic() {
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    const hasKey = apiKey.length > 5 && !apiKey.includes('undefined') && apiKey !== 'MY_ANTHROPIC_API_KEY';
    if (!anthropicClient && hasKey) {
      anthropicClient = new Anthropic({
        apiKey: apiKey,
      });
    }
    return anthropicClient;
  }
  
  const { GoogleGenAI } = await import('@google/genai');
  let googleAI: any = null;
  function getGoogleAI() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const hasApiKey = apiKey.length > 5 && !apiKey.includes('undefined') && apiKey !== 'your_gemini_api_key_here' && apiKey !== 'MY_GEMINI_API_KEY';
    if (!googleAI && hasApiKey) {
      googleAI = new GoogleGenAI({ apiKey });
    }
    return googleAI;
  }

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', vite_keys: Object.keys(process.env).filter(k => k.includes('GEMINI')), val: process.env.GEMINI_API_KEY });
  });

  // Proxy Binance Market Data Request
  // E.g., /api/market-data?symbol=BTCUSDT&interval=1h&limit=100
  app.get('/api/market-data', async (req, res) => {
    try {
      const { symbol = 'BTCUSDT', interval = '1h', limit = 100 } = req.query as any;
      const cacheKey = `market_${symbol}_${interval}_${limit}`;

      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Check if it's a simulated stock (doesn't end with USDT/USDC and is common stock ticker)
      const stockTickers = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'NFLX'];
      if (stockTickers.includes(symbol)) {
        // Generate simulated stock data
        const basePrice: Record<string, number> = { 
          'NVDA': 120, 'TSLA': 180, 'AAPL': 190, 'MSFT': 420, 
          'AMZN': 185, 'GOOGL': 175, 'META': 500, 'NFLX': 600 
        };
        const start = basePrice[symbol] || 100;
        const limitNum = parseInt(limit);
        const intervalMs = interval.includes('h') ? 3600000 : (interval.includes('m') ? 60000 : 86400000);
        
        const simulated = Array.from({ length: limitNum }, (_, i) => {
          const time = Math.floor((Date.now() - (limitNum - i) * intervalMs) / 1000);
          const volatility = start * 0.02;
          const open = start + (Math.random() - 0.5) * volatility;
          const close = open + (Math.random() - 0.5) * (volatility / 2);
          const high = Math.max(open, close) + Math.random() * (volatility / 4);
          const low = Math.min(open, close) - Math.random() * (volatility / 4);
          return { time, open, high, low, close, volume: Math.random() * 1000000 };
        });
        
        cache.set(cacheKey, simulated);
        return res.json(simulated);
      }

      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol, interval, limit }
      });

      // Format Binance arrays into objects for lightweight charts: { time, open, high, low, close, volume }
      const formattedData = response.data.map((candle: any[]) => ({
        time: Math.floor(candle[0] / 1000), // seconds timestamp
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      cache.set(cacheKey, formattedData);
      res.json(formattedData);
    } catch (err: any) {
      console.error('Binance API error:', err.message);
      // Minimal fallback to prevent total UI collapse
      const fallback = Array.from({ length: 20 }, (_, i) => ({
        time: Math.floor(Date.now() / 1000) - (20 - i) * 3600,
        open: 50000 + Math.random() * 100,
        high: 50100 + Math.random() * 100,
        low: 49900 + Math.random() * 100,
        close: 50000 + Math.random() * 100,
        volume: 1000
      }));
      res.json(fallback);
    }
  });

  // Crypto & Stock News API
  app.get('/api/market-intel', async (req, res) => {
    try {
      const { symbol = 'BTC' } = req.query as any;
      const cleanSymbol = symbol.replace('USDT', '').toUpperCase();
      const cacheKey = `news_${cleanSymbol}`;
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);

      const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
      // Fetch news for the specific asset if it's crypto
      const isStock = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'NFLX'].includes(cleanSymbol);
      
      let articles = [];

      if (!isStock) {
        const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${cleanSymbol}${apiKey ? `&api_key=${apiKey}` : ''}`;
        const response = await axios.get(url);
        
        if (response.data.Response !== 'Error' && response.data.Data && Array.isArray(response.data.Data)) {
          articles = response.data.Data.slice(0, 15).map((article: any) => ({
            id: article.id,
            title: article.title,
            source: article.source_info.name,
            url: article.url,
            imageUrl: article.imageurl,
            publishedAt: article.published_on
          }));
        }
      }

      // If articles are empty or it's a stock, add targeted simulated news for "wider range"
      if (articles.length < 3) {
        const fallbackMap: Record<string, string[]> = {
          'BTC': ['Institutions Eye BTC as Digital Gold Alternative', 'Bitcoin Hashrate Hits New Record High', 'ETF Inflows Sustain Bullish Momentum'],
          'NVDA': ['NVIDIA Blackwell Chips See Unprecedented Demand', 'AI Data Center Growth Fueling NVDA Revenue', 'Analysts Raise Price Target for NVIDIA'],
          'TSLA': ['Tesla FSD V12 Rollout Shows Significant Gains', 'CyberTruck Production Increasing Weekly', 'Tesla Energy Division Seeing 100% YoY Growth'],
          'DOGE': ['Dogecoin Integration Rumors Surface Again', 'Top 100 Wallets Accumulate DOGE', 'Meme Coins Lead Weekly Volume Charts'],
          'AAPL': ['iPhone 16 Pro Leaks Suggest Major Camera Overhaul', 'Apple Vision Pro Expansion to International Markets', 'Services Revenue Gains Drive Apple Stability']
        };

        const simulated = (fallbackMap[cleanSymbol] || [`${cleanSymbol} Market Dynamics Shifting Amid Volume Spike`]).map((title, i) => ({
          id: `sim-${cleanSymbol}-${i}`,
          title,
          source: i % 2 === 0 ? 'MarketPulse' : 'TechBrief',
          url: '#',
          imageUrl: '',
          publishedAt: Math.floor(Date.now()/1000) - (i * 3600)
        }));
        
        articles = [...articles, ...simulated].slice(0, 15);
      }

      cache.set(cacheKey, articles, 300); // 5 min cache
      res.json(articles);
    } catch (err: any) {
      console.error('News fetch error:', err.message);
      res.json([{ id: 'err', title: 'Market data feed interrupted. Check connection.', source: 'System', url: '#', imageUrl: '', publishedAt: Date.now()/1000 }]);
    }
  });

  // Gemini API Proxy
  app.post('/api/predict-gemini', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(404).json({ error: 'Gemini AI unavailable (Missing API Key on Server)' });
      }

      const { prompt, schema } = req.body;
      
      // Use direct REST API to bypass any SDK parsing/version issues
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      if (errMsg?.includes('API key not valid') || errMsg?.includes('API_KEY_INVALID')) {
        return res.status(404).json({ error: 'Gemini AI unavailable (Invalid API Key on Server)' });
      }
      console.error('Gemini proxy error:', errMsg);
      res.status(500).json({ error: 'Gemini Analysis failed: ' + errMsg });
    }
  });

// AI Prediction Proxy (Anthropic Fallback Only)
  app.post('/api/predict-fallback', async (req, res) => {
    try {
      const { symbol, recentPrice, rsi, macd, sma, change24h } = req.body;
      const anthropic = getAnthropic();
      
      if (!anthropic) {
        return res.status(404).json({ error: 'Fallback AI unavailable' });
      }

      const prompt = `Quick technical analysis for ${symbol} @ $${recentPrice}.
RSI: ${rsi}, MACD: ${macd.macdLine}, SMA20: ${sma.sma20}.
Bias: [BULLISH/BEARISH/NEUTRAL]
Analysis: 2 sentences.`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      });

      const contentBlock = response.content[0] as any;
      res.json({ prediction: contentBlock.text, provider: 'Claude 3.5' });

    } catch (err: any) {
      if (err.message?.includes('authentication') || err.message?.includes('api_key') || err.status === 401) {
         return res.status(401).json({ error: 'Auth failed for Anthropic (Invalid API Key)' });
      }
      console.error('Anthropic Fallback error:', err.message);
      res.status(500).json({ error: 'Analysis failed: ' + err.message });
    }
  });

  // Strategy Performance Metrics
  app.get('/api/strategy-performance', (req, res) => {
    const { strategy = 'RSI Mean Reversion' } = req.query;
    
    // Simulate real-time performance metrics
    // In a real app, these would be pulled from a database of historical trade results
    const winRate = 52 + Math.random() * 8;
    const avgReturn = 1.2 + Math.random() * 0.5;
    const numTrades = 120 + Math.floor(Math.random() * 50);
    const profitFactor = 1.4 + Math.random() * 0.3;
    const maxDrawdown = 4 + Math.random() * 2;

    res.json({
      strategy,
      winRate: winRate.toFixed(1),
      avgReturn: avgReturn.toFixed(2),
      numTrades,
      profitFactor: profitFactor.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(1),
      timestamp: Date.now()
    });
  });

  app.use('/api/trade', tradeRoute);
  app.use('/api/account', accountRoute);

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Note: Use process.cwd() for path resolution in native ESM
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
