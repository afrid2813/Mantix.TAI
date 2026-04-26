const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyCHqvrla7KxPfa4IvYyptyyTJ24OZrjr_Q';

async function test(modelRaw) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelRaw}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: "hi" }] }]
    })
  });
  const data = await res.json();
  if (data.error) {
     console.log(modelRaw, "ERROR:", data.error.message);
  } else {
     console.log(modelRaw, "SUCCESS");
  }
}

async function run() {
  await test("gemini-2.5-flash");
  await test("gemini-flash-latest");
  await test("gemini-1.5-flash");
}
run();
