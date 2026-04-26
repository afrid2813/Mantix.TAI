import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import NodeCache from 'node-cache';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';

// Using Native Node 22.14 TS support -> NO ENUMS here
const cache = new NodeCache({ stdTTL: 60 }); // 60 seconds cache

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Init AI clients lazily
  let anthropicClient: Anthropic | null = null;

  function getAnthropic() {
    if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
      anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
    return anthropicClient;
  }

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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
      console.error('Anthropic Fallback error:', err.message);
      res.status(500).json({ error: 'Analysis failed' });
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
