import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const response = await axios.get('http://69.169.97.10:8000/account', { timeout: 5000 });
    res.json(response.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/positions', async (req, res) => {
  try {
    const response = await axios.get('http://69.169.97.10:8000/positions', { timeout: 5000 });
    res.json(response.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
