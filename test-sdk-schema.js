import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI();
async function run() {
  try {
     await ai.models.generateContent({
       model: "gemini-flash-latest",
       contents: "hi",
       config: {
         responseMimeType: "application/json",
         responseSchema: {
           type: undefined,
           properties: {
             score: { type: "UNKNOWN_TYPE" }
           }
         }
       }
     });
        console.log("SUCCESS");
  } catch(e) {
     console.log("SDK ERROR:", e.message);
  }
}
run();
