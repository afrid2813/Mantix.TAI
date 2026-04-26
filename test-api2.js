import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyCHqvrla7KxPfa4IvYyptyyTJ24OZrjr_Q' });
async function testModel(modelName) {
  try {
    await ai.models.generateContent({
      model: modelName,
      contents: "hello",
    });
    console.log(modelName, "SUCCESS");
  } catch (e) {
    if (e.message.includes('API key not valid')) {
       console.log(modelName, "SUCCESS (Expected invalid API key error)"); 
    } else {
       console.log(modelName, "ERROR:", e.message);
    }
  }
}
async function run() {
  await testModel("gemini-2.5-flash");
  await testModel("gemini-1.5-flash");
  await testModel("gemini-flash-latest");
}
run();
