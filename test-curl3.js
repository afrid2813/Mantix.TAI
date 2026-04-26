async function test() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=testing`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: "hi" }] }]
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
