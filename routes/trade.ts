import { Router } from 'express';
import { executeTrade } from '../services/executionEngine';
import axios from 'axios';

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
      const action = side === 'BUY' ? 'buy' : 'sell';
      const lot = quantity || 0.01;
      
      // Explicitly call POST with only query params and no body to avoid 422 errors
      const response = await axios({
        method: 'post',
        url: `${vpsUrl}/trade`,
        params: {
          action,
          lot
        }
      });

      if (response.status === 200) {
        return res.json({ success: true, data: response.data });
      } else {
        return res.status(response.status).json({ success: false, error: response.data.message || 'VPS Trade failed' });
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      return res.status(err.response?.status || 500).json({ 
        success: false, 
        error: errorData?.message || `VPS Connection failed: ${err.message}` 
      });
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
