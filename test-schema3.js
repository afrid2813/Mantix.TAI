import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'fake_key_123' });

const schema = {"type":"OBJECT","properties":{"score":{"type":"NUMBER"},"summary":{"type":"STRING"},"label":{"type":"STRING"},"impact_drivers":{"type":"ARRAY","items":{"type":"STRING"}}},"required":["score","summary","label","impact_drivers"]}

async function run() {
  try {
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Just return a test",
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    console.log("SUCCESS");
  } catch (err) {
    if (err.message.includes('API key not valid')) {
      console.log("SUCCESS (Invalid key expected)");
    } else {
      console.log("ERROR 2:", err.message);
    }
  }
}
run();
