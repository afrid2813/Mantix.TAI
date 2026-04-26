import { Router } from 'express';
import { getAccountInfo } from '../services/binanceService.js';

const router = Router();

router.post('/', async (req, res) => {
  const { apiKey, secretKey } = req.body;
  if (!apiKey || !secretKey) {
    return res.status(400).json({ success: false, error: 'API Key and Secret Key are required' });
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
