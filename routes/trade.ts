import { Router } from 'express';
import { executeTrade } from '../services/executionEngine';
import axios from 'axios';

const router = Router();

router.post('/', async (req, res) => {
  // Support both body and query params for VPS integration
  const queryAction = req.query.action as string;
  const queryLot = req.query.lot as string;

  const querySl = req.query.sl as string;
  const queryTp = req.query.tp as string;

  const {
    apiKey,
    secretKey,
    symbol,
    side,
    quantity,
    balance,
    type: bodyType,
    sl: bodySl,
    tp: bodyTp,
  } = req.body;

  const type = bodyType || (queryAction ? 'vantage' : null);
  const effectiveSide = side || (queryAction ? queryAction.toUpperCase() : null);
  const effectiveQuantity = quantity || (queryLot ? parseFloat(queryLot) : 0.01);
  const effectiveSl = bodySl || querySl;
  const effectiveTp = bodyTp || queryTp;

  if (type === 'vantage') {
    const vpsUrl = process.env.VPS_API_URL || 'http://69.169.97.10:8000';
    try {
      const action = effectiveSide === 'BUY' ? 'buy' : 'sell';
      const lot = effectiveQuantity || 0.01;
      
      // Explicitly call POST with only query params and no body to avoid 422 errors
      const params: any = { action, lot };
      if (effectiveSl) params.sl = effectiveSl;
      if (effectiveTp) params.tp = effectiveTp;

      const response = await axios({
        method: 'post',
        url: `${vpsUrl}/trade`,
        params
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
    side: effectiveSide,
    quantity: effectiveQuantity,
    balance,
    sl: effectiveSl,
    tp: effectiveTp,
  });

  if (result.success) {
      res.json(result);
  } else {
      res.status(400).json(result);
  }
});

export default router;
