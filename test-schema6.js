import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyCHqvrla7KxPfa4IvYyptyyTJ24OZrjr_Q' });

// Schema with missing type in properties
const schema1 = {
  type: "OBJECT",
  properties: {
    action: { description: "BUY | SELL | HOLD" }
  }
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
