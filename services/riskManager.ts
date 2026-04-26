export function checkRisk({ balance, riskPercent, tradeAmount }: any) {
  const maxRisk = balance * (riskPercent / 100);
  if (tradeAmount > maxRisk) {
    return {
      allowed: false,
      message: 'Risk too high',
    };
  }
  return { allowed: true };
}
