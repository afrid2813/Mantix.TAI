const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCHqvrla7KxPfa4IvYyptyyTJ24OZrjr_Q';
async function test() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: "hi" }] }],
      generationConfig: {
         responseMimeType: "application/json",
         responseSchema: {
           type: "object",
           properties: {
             score: { type: "NUMBER" },
             summary: { type: "STRING" }
           }
         }
      }
    })
  });
  const data = await res.json();
  if (data.error) {
     console.log("ERROR:", data.error.message);
  } else {
     console.log("SUCCESS");
  }
}
test();
