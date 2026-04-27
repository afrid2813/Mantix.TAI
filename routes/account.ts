import { Router } from 'express';
import { getAccountInfo } from '../services/binanceService.js';
import fetch from 'node-fetch';

const router = Router();

router.post('/', async (req, res) => {
  const { apiKey, secretKey, type } = req.body;
  if (!apiKey || !secretKey) {
    return res.status(400).json({ success: false, error: 'API Key and Secret Key are required' });
  }

  if (type === 'vantage') {
    const vpsUrl = process.env.VPS_API_URL || 'http://69.169.97.10:8000';
    try {
      const response = await fetch(`${vpsUrl}/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: apiKey,
          token: secretKey,
          server: req.body.server,
        }),
      });

      const data: any = await response.json();
      if (response.ok) {
        return res.json({ 
          success: true, 
          data: data, 
          balance: data.balance || data.equity || 0 
        });
      } else {
        return res.status(response.status).json({ success: false, error: data.message || 'VPS Account check failed' });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: `VPS Connection failed: ${err.message}` });
    }
  }

  try {
    const data: any = await getAccountInfo({ apiKey, secretKey });

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid response from Binance' });
    }
    
    // Sum USDT balance or return full data
    let totalBalance = 0;
    if (data.USDT) {
      totalBalance = parseFloat(data.USDT.available || '0');
    }

    if (totalBalance === 0 && !data.USDT) {
      return res.status(400).json({ success: false, error: 'Could not read balance. Check API permissions.' });
    }

    res.json({ success: true, data, balance: totalBalance });
  } catch (err: any) {
    let errMsg = err;
    try {
      if (err.body) errMsg = JSON.parse(err.body);
    } catch(e) {}
    res.status(400).json({
      success: false,
      error: errMsg?.msg || err.message || 'Verification failed',
    });
  }
});

export default router;
