import { Router } from 'express';
import { executeTrade } from '../services/executionEngine';
import fetch from 'node-fetch';

const router = Router();

router.post('/', async (req, res) => {
  const {
    apiKey,
    secretKey,
    symbol,
    side,
    quantity,
    balance,
    type, // 'binance' or 'vantage'
  } = req.body;

  if (type === 'vantage') {
    const vpsUrl = process.env.VPS_API_URL || 'http://69.169.97.10:8000';
    try {
      const response = await fetch(`${vpsUrl}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: apiKey,
          token: secretKey,
          server: req.body.server,
          symbol,
          action: side.toLowerCase(),
          volume: quantity,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        return res.json({ success: true, data });
      } else {
        return res.status(response.status).json({ success: false, error: data.message || 'VPS Trade failed' });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: `VPS Connection failed: ${err.message}` });
    }
  }

  if (!apiKey || !secretKey) {
    return res.status(400).json({ success: false, error: 'API Key and Secret Key are required' });
  }

  const result = await executeTrade({
    apiKey,
    secretKey,
    symbol,
    side,
    quantity,
    balance,
  });

  if (result.success) {
      res.json(result);
  } else {
      res.status(400).json(result);
  }
});

export default router;
