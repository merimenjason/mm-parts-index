// Vercel serverless function: proxies OCR calls to the Anthropic API so the
// API key is never exposed in the browser. The frontend posts the same body
// it would send to /v1/messages; we add the key + version headers here.
//
// Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.
// (On Netlify, put an equivalent function under netlify/functions/ocr.js.)
//
// HARDENING (v1.12.0) — the endpoint is publicly reachable, so it constrains
// what a caller can spend rather than forwarding arbitrary bodies:
//   • model must be on the whitelist below (the four the Ingest tab offers)
//   • max_tokens is capped (an attacker can't request a 100k-token generation)
//   • optional shared secret: set OCR_PROXY_TOKEN server-side and build the app
//     with VITE_OCR_PROXY_TOKEN to require an x-ocr-token header. This deters
//     drive-by abuse only — the token ships in the client bundle, so it is NOT
//     real authentication. Proper per-user auth remains an open gap (see
//     OPUS_PROMPTS.md P3).

const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-8",
  "claude-fable-5",
]);
const MAX_TOKENS_CAP = 16384;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server" });
    return;
  }
  // Optional shared secret — enforced only when configured, so existing
  // deployments keep working until the env vars are set on both sides.
  if (process.env.OCR_PROXY_TOKEN && req.headers["x-ocr-token"] !== process.env.OCR_PROXY_TOKEN) {
    res.status(401).json({ error: "missing or invalid x-ocr-token" });
    return;
  }
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : (req.body || null);
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "body must be a JSON /v1/messages payload" });
    return;
  }
  if (!ALLOWED_MODELS.has(body.model)) {
    res.status(400).json({ error: `model "${String(body.model)}" is not allowed by this proxy` });
    return;
  }
  body.max_tokens = Math.min(Number(body.max_tokens) || 8192, MAX_TOKENS_CAP);

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Upstream request failed", detail: String(err) });
  }
}
