import { Router } from 'express';
import { executeTrade } from '../services/executionEngine';

const router = Router();

router.post('/', async (req, res) => {
  const {
    apiKey,
    secretKey,
    symbol,
    side,
    quantity,
    balance,
  } = req.body;

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
