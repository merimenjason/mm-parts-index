// Vercel serverless function: proxies OCR calls to the Anthropic API so the
// API key is never exposed in the browser. The frontend posts the same body
// it would send to /v1/messages; we add the key + version headers here.
//
// Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.
// (On Netlify, put an equivalent function under netlify/functions/ocr.js.)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server" });
    return;
  }
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Upstream request failed", detail: String(err) });
  }
}
