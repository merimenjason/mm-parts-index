/* ============================================================================
   /api/parts — the app's read/write endpoint for the shared dataset.

   GET  /api/parts            → { parts: [...] }   (the whole dataset)
   POST /api/parts            → replace or append the dataset
        body { mode: "replace", parts: [...] }   (default; mirrors saveDS)
        body { mode: "append",  parts: [...] }   (bulk ingest add)

   The browser NEVER holds the Turso auth token; it talks only to this endpoint,
   exactly as it talks to /api/ocr for OCR. Keep the DB credentials server-side.

   The parts posted here are already-enriched line objects (the client runs
   enrichPart from src/pipeline.js before saving), so this endpoint does no
   business logic — it is a thin, guarded persistence boundary. Validation of
   OCR output still happens upstream in the batch runner / ingest path.
   ========================================================================== */

import { getDataset, replaceDataset, upsertParts, ensureSchema } from "./_db.js";

const MAX_PARTS = 100000;               // generous ceiling; the 200-invoice run is ~a few thousand
const MAX_BODY_BYTES = 25 * 1024 * 1024; // refuse absurd payloads early

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      await ensureSchema();
      const data = await getDataset();
      res.status(200).json(data);
      return;
    }

    if (req.method === "POST") {
      // Vercel parses JSON bodies automatically; guard size and shape.
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      if (raw.length > MAX_BODY_BYTES) {
        res.status(413).json({ error: "payload too large" });
        return;
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const { mode = "replace", parts } = body;
      if (!Array.isArray(parts)) {
        res.status(400).json({ error: "body.parts must be an array of enriched line objects" });
        return;
      }
      if (parts.length > MAX_PARTS) {
        res.status(413).json({ error: `too many parts (${parts.length} > ${MAX_PARTS})` });
        return;
      }

      await ensureSchema();
      const n = mode === "append" ? await upsertParts(parts) : await replaceDataset(parts);
      res.status(200).json({ ok: true, mode, written: n });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    // Surface a clean error; never leak the connection string / token.
    res.status(500).json({ error: "database error", detail: String(err && err.message ? err.message : err) });
  }
}
