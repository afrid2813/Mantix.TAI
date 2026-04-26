import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyCHqvrla7KxPfa4IvYyptyyTJ24OZrjr_Q' });

// Schema without 'type: "OBJECT"'
const schema1 = {
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

async function test1() {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: "Analyze this: ...",
      config: {
        responseMimeType: "application/json",
        responseSchema: schema1
      }
    });
    console.log("TEST 1 SUCCESS");
  } catch (e) {
    console.log("TEST 1 ERROR", e.message);
  }
}

test1();
