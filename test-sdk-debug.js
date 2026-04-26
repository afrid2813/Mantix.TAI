import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'foo' });

async function run() {
  const schema = {
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
  };
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: "hello",
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    console.log(response.text);
  } catch (err) {
    if (err.details) {
       console.log("DETAILS", JSON.stringify(err.details));
    }
    throw err;
  }
}
run();
