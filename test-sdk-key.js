import { GoogleGenAI } from '@google/genai';
try {
  new GoogleGenAI({ apiKey: "\nfoo\n" });
  console.log("No error on new GoogleGenAI");
} catch(e) {
  console.log("ERROR on new GoogleGenAI:", e.message);
}
