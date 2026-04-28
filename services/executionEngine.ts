import { placeOrder } from './binanceService';
import { checkRisk } from './riskManager';

export async function executeTrade(params: any) {
  const {
    apiKey,
    secretKey,
    symbol,
    side,
    quantity,
    balance,
    sl,
    tp,
  } = params;

  // Step 1: Risk Check
  const risk = checkRisk({
    balance,
    riskPercent: 1, // Scaled down based on project needs
    tradeAmount: quantity,
  });

  if (!risk.allowed) {
    return { success: false, message: risk.message };
  }

  // Step 2: Execute
  try {
    const result = await placeOrder({
      apiKey,
      secretKey,
      symbol,
      side,
      quantity,
      sl,
      tp,
    });
    return { success: true, data: result };
  } catch (err: any) {
    let errMsg = err;
    try {
      if (err.body) errMsg = JSON.parse(err.body);
    } catch(e) {}
    return { success: false, error: errMsg?.msg || err.message || 'Execution failed' };
  }
}
