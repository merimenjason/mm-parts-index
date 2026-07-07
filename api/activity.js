/* ============================================================================
   /api/activity — the app's read/append endpoint for the persistent activity log.

   GET  /api/activity?limit=500   → { events: [...] }   (newest first)
   POST /api/activity             → append one event
        body { event: { id, ts, kind, action, message, source, count, status, detail } }

   The activity log is an append-only stream of ingest / OCR / review / dataset
   events. It mirrors api/parts.js: the browser talks only to this same-origin
   endpoint and never holds the Turso auth token (kept server-side in api/_db.js).

   Events are already-shaped objects (the client builds them in logEvent), so this
   endpoint does no business logic — it is a thin, guarded persistence boundary.
   ========================================================================== */

import { getActivity, appendActivity, ensureSchema } from "./_db.js";

const MAX_BODY_BYTES = 256 * 1024; // an event (with detail) is tiny; refuse anything absurd

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      await ensureSchema();
      const limit = parseInt(req.query?.limit, 10) || 500;
      const events = await getActivity(limit);
      res.status(200).json({ events });
      return;
    }

    if (req.method === "POST") {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      if (raw.length > MAX_BODY_BYTES) {
        res.status(413).json({ error: "payload too large" });
        return;
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const ev = body.event;
      if (!ev || typeof ev !== "object" || Array.isArray(ev)) {
        res.status(400).json({ error: "body.event must be an event object" });
        return;
      }
      await ensureSchema();
      await appendActivity(ev);
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    // Never leak the connection string / token.
    res.status(500).json({ error: "database error", detail: String(err && err.message ? err.message : err) });
  }
}
