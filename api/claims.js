/* ============================================================================
   /api/claims — the app's read/write endpoint for the shared Claim History
   (Assess a Claim tab).

   GET    /api/claims?limit=200   → { claims: [...] }   (newest first)
   POST   /api/claims             → save (insert or replace) one claim
        body { claim: { id, savedAt, claimRef, workshop, plate, make, model,
                         snapshotId, inflPct, invoices, usableLines,
                         appVersion, generatedAt, cfg, rows } }
   DELETE /api/claims?id=<id>     → remove one claim

   Mirrors api/activity.js: the browser talks only to this same-origin
   endpoint and never holds the Turso auth token (kept server-side in
   api/_db.js). Claims are already-shaped records (the client builds them in
   Assess()'s handleSaveClaim), so this endpoint does no business logic — it
   is a thin, guarded persistence boundary.
   ========================================================================== */

import { getClaims, saveClaim, deleteClaim, ensureSchema } from "./_db.js";

const MAX_BODY_BYTES = 5 * 1024 * 1024; // a claim's rows carry full cluster evidence, so allow more than an activity event

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      await ensureSchema();
      const limit = parseInt(req.query?.limit, 10) || 200;
      const claims = await getClaims(limit);
      res.status(200).json({ claims });
      return;
    }

    if (req.method === "POST") {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      if (raw.length > MAX_BODY_BYTES) {
        res.status(413).json({ error: "payload too large" });
        return;
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const c = body.claim;
      if (!c || typeof c !== "object" || Array.isArray(c) || !c.id) {
        res.status(400).json({ error: "body.claim must be an object with an id" });
        return;
      }
      await ensureSchema();
      await saveClaim(c);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (!id) {
        res.status(400).json({ error: "?id is required" });
        return;
      }
      await ensureSchema();
      await deleteClaim(id);
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    // Never leak the connection string / token.
    res.status(500).json({ error: "database error", detail: String(err && err.message ? err.message : err) });
  }
}
