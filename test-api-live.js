const data = JSON.stringify({
  prompt: "Analyze the trend for BTC at $60000",
  schema: {
    type: "OBJECT",
    properties: {
      action: { type: "STRING", description: "BUY | SELL | HOLD" },
      confidence: { type: "NUMBER", description: "0-100" },
      entry_price: { type: "NUMBER" },
      stop_loss: { type: "NUMBER" },
      take_profit: { type: "NUMBER" },
      position_size: { type: "NUMBER" },
      reason: { type: "STRING", description: "short explanation" }
    },
    required: ["action", "confidence", "entry_price", "stop_loss", "take_profit", "position_size", "reason"]
  }
});

async function run() {
  const response = await fetch('http://localhost:3000/api/predict-gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data
  });
  console.log('Status Code:', response.status);
  const text = await response.text();
  console.log('Response Body:', text);
}
run();
