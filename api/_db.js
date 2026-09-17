/* ============================================================================
   PartsIndex — server-side data layer (Turso / libSQL over HTTP)

   WHY THIS FILE EXISTS
   The app persists a dataset of the shape { parts: [ ...enriched line objects ] }.
   In the browser-only build that blob lives in localStorage (see loadDS/saveDS
   in src/PartsIndex.jsx). To make the benchmark a SHARED, durable reference —
   many users querying one dataset — the parts must move to a real database.

   WHY TURSO / libSQL (not file-based SQLite)
   Vercel serverless functions run on an ephemeral, effectively read-only
   filesystem (only /tmp is writable, it is discarded between invocations, and
   concurrent instances do NOT share it). A file-based SQLite .db therefore
   cannot persist writes on Vercel. libSQL is Turso's SQLite fork exposed over
   HTTP: identical SQL and schema, but the client talks to a remote database
   over stateless HTTP — which is exactly what ephemeral serverless wants
   (lightweight per-request calls, no always-on TCP pool).

   ONE URL CHANGE between local and prod:
     local dev :  TURSO_DATABASE_URL = file:local.db        (a real SQLite file)
     production:  TURSO_DATABASE_URL = libsql://<db>.turso.io  + TURSO_AUTH_TOKEN
   Same code path; only the env vars differ.

   IMPORTANT: this module is SERVER-ONLY. It reads TURSO_AUTH_TOKEN, which must
   never reach the browser. It is imported by Vercel functions under /api, the
   same trust boundary as api/ocr.js. The React app never imports it; it calls
   the /api/parts endpoint over fetch().

   The heavy statistics (median / IQR / clustering) deliberately stay in
   src/pipeline.js. We store the raw enriched lines here and let the existing,
   Excel-reconcilable JS compute benchmarks — moving them into SQL would quietly
   change the numbers (SQLite's quantiles won't match our PERCENTILE.INC choice).
   ========================================================================== */

import { createClient } from "@libsql/client";

/* The full set of enriched-line fields the app persists, in a stable order.
   Keep this in lockstep with enrichPart() in src/pipeline.js. Adding a field:
   append it here AND to the CREATE TABLE below AND bump SCHEMA_VERSION. */
export const PART_COLUMNS = [
  "id", "bill_no", "supplier", "bill_date", "make", "model",
  "part_name", "part_number", "npn", "cat", "qty", "unit", "total",
  "ltype", "doc_type", "src", "grade", "unit_basis", "gst",
  "review", "review_reason",
];

/* Columns for the append-only activity/ingest log. One row per event, with an
   ISO-8601 timestamp and a JSON `detail` blob the UI expands for drill-down.
   Keep in lockstep with the event object built in src/PartsIndex.jsx (logEvent)
   and the activity backend in src/datasource.js. */
export const ACTIVITY_COLUMNS = [
  "id", "ts", "kind", "action", "message", "source", "count", "status", "detail",
];

/* Claim History (Assess a Claim tab): one row per saved assessment. `cfg` and
   `rows` are stored as JSON blobs — `rows` carries the full assessed lines
   including cluster evidence (same shape the app already builds in memory),
   so a reopened claim renders identically and can still be re-exported.
   Keep in lockstep with the record built in Assess()'s handleSaveClaim
   (src/PartsIndex.jsx) and the claims backend in src/datasource.js. */
export const CLAIM_COLUMNS = [
  "id", "saved_at", "claim_ref", "workshop", "plate", "make", "model",
  "snapshot_id", "infl_pct", "invoices", "usable_lines", "app_version",
  "generated_at", "cfg", "rows",
];

export const SCHEMA_VERSION = 3;

let _client = null;

/* Lazily create a singleton libSQL client from env.
   - TURSO_DATABASE_URL: file:local.db  OR  libsql://<name>.turso.io
   - TURSO_AUTH_TOKEN:   required for libsql:// (remote), omitted for file:  */
export function db() {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set (e.g. file:local.db locally, or libsql://<db>.turso.io in production)");
  _client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return _client;
}

/* Create tables if absent. Cheap to call on every request (IF NOT EXISTS), but
   in practice you run it once via `npm run db:init`. The parts table stores one
   row per enriched supplier-part line — the exact objects the app already holds
   in memory — so no reshaping is needed on read. A meta table records the
   schema version for future migrations. */
export async function ensureSchema() {
  await db().batch([
    `CREATE TABLE IF NOT EXISTS meta (
       key   TEXT PRIMARY KEY,
       value TEXT
     )`,
    `CREATE TABLE IF NOT EXISTS parts (
       id           TEXT PRIMARY KEY,
       bill_no      TEXT,
       supplier     TEXT,
       bill_date    TEXT,
       make         TEXT,
       model        TEXT,
       part_name    TEXT,
       part_number  TEXT,
       npn          TEXT,
       cat          TEXT,
       qty          REAL,
       unit         REAL,
       total        REAL,
       ltype        TEXT,
       doc_type     TEXT,
       src          TEXT,
       grade        TEXT,
       unit_basis   TEXT,
       gst          TEXT,
       review       INTEGER,        -- 0 / 1
       review_reason TEXT
     )`,
    // Append-only activity/ingest log — persisted so the Ingest tab's history
    // survives reloads and (on the shared backend) is shared across users.
    `CREATE TABLE IF NOT EXISTS activity (
       id       TEXT PRIMARY KEY,
       ts       TEXT,            -- ISO-8601 date+time the event occurred
       kind     TEXT,            -- ingest | ocr | review | dataset | error | info
       action   TEXT,            -- short label, e.g. "OCR invoice"
       message  TEXT,            -- human-readable summary
       source   TEXT,            -- originating file / bill, when applicable
       count    INTEGER,         -- part lines affected
       status   TEXT,            -- ok | warn | error | info
       detail   TEXT             -- JSON blob of extra fields for drill-down
     )`,
    // Claim History (Assess a Claim tab) — one row per saved assessment, shared
    // across users on the shared backend. `cfg` and `rows` are JSON blobs (see
    // CLAIM_COLUMNS above).
    `CREATE TABLE IF NOT EXISTS claims (
       id            TEXT PRIMARY KEY,
       saved_at      TEXT,           -- ISO-8601 timestamp the claim was saved
       claim_ref     TEXT,
       workshop      TEXT,           -- OCR-extracted repairer name, if any
       plate         TEXT,           -- OCR-extracted vehicle plate, if any
       make          TEXT,
       model         TEXT,
       snapshot_id   TEXT,           -- benchmark snapshot id at save time
       infl_pct      REAL,
       invoices      INTEGER,
       usable_lines  INTEGER,
       app_version   TEXT,
       generated_at  TEXT,
       cfg           TEXT,           -- JSON: matching config snapshot
       rows          TEXT            -- JSON: assessed lines incl. cluster evidence
     )`,
    // Indexes for the app's common lookups (make filter, PN search, dedup) and
    // the activity log's / claim history's newest-first read.
    `CREATE INDEX IF NOT EXISTS idx_parts_make ON parts(make)`,
    `CREATE INDEX IF NOT EXISTS idx_parts_npn  ON parts(npn)`,
    `CREATE INDEX IF NOT EXISTS idx_parts_bill ON parts(supplier, bill_no)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(ts)`,
    `CREATE INDEX IF NOT EXISTS idx_claims_saved_at ON claims(saved_at)`,
    { sql: `INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', ?)`, args: [String(SCHEMA_VERSION)] },
  ], "write");
}

/* Turn a stored row (all-lowercase columns, review as 0/1) back into the exact
   part-object shape the app expects in { parts: [...] }. */
function rowToPart(row) {
  return {
    id: row.id, bill_no: row.bill_no || "", supplier: row.supplier || "",
    bill_date: row.bill_date || "", make: row.make || "Unknown", model: row.model || "—",
    part_name: row.part_name || "", part_number: row.part_number || "", npn: row.npn || "",
    cat: row.cat || "Other", qty: Number(row.qty) || 1, unit: Number(row.unit) || 0,
    total: Number(row.total) || 0, ltype: row.ltype || "Supplier Part",
    doc_type: row.doc_type || "Tax Invoice", src: row.src || "excel",
    grade: row.grade || "Unknown", unit_basis: row.unit_basis || "each", gst: row.gst || "unknown",
    review: !!row.review, review_reason: row.review_reason || "",
  };
}

/* Read the whole dataset in the app's native shape: { parts: [...] }.
   For the POC's data volume (200 invoices ≈ a few thousand lines) a full read
   is fine and keeps the client identical to the localStorage build. If the
   corpus grows large, add pagination or push filters into SQL here — the app's
   Ledger/Benchmark already filter client-side, so this stays a drop-in. */
export async function getDataset() {
  const res = await db().execute("SELECT * FROM parts");
  return { parts: res.rows.map(rowToPart) };
}

/* Insert/replace many enriched lines in one batched write (atomic). Used by the
   ingest endpoint after validateInvoice()/enrichPart() have already run. Upsert
   on id means re-importing the same lines is idempotent. */
export async function upsertParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return 0;
  const placeholders = PART_COLUMNS.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO parts (${PART_COLUMNS.join(", ")}) VALUES (${placeholders})`;
  const stmts = parts.map((p) => ({
    sql,
    args: PART_COLUMNS.map((c) => (c === "review" ? (p.review ? 1 : 0) : (p[c] ?? null))),
  }));
  await db().batch(stmts, "write");
  return stmts.length;
}

/* Replace the entire dataset transactionally (delete-all then bulk insert).
   Mirrors the app's saveDS(): the client holds the authoritative in-memory
   dataset and writes it back wholesale. batch(..., "write") runs as one
   transaction, so a failure leaves the old data intact. */
export async function replaceDataset(parts) {
  const placeholders = PART_COLUMNS.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO parts (${PART_COLUMNS.join(", ")}) VALUES (${placeholders})`;
  const stmts = [{ sql: "DELETE FROM parts", args: [] }];
  for (const p of (parts || [])) {
    stmts.push({ sql, args: PART_COLUMNS.map((c) => (c === "review" ? (p.review ? 1 : 0) : (p[c] ?? null))) });
  }
  await db().batch(stmts, "write");
  return (parts || []).length;
}

/* ---- activity log ---- */

/* Turn a stored activity row back into the event object the app renders, parsing
   the JSON detail blob (tolerating a malformed one rather than throwing). */
function rowToEvent(row) {
  let detail = null;
  if (row.detail) { try { detail = JSON.parse(row.detail); } catch { detail = { raw: String(row.detail) }; } }
  return {
    id: row.id, ts: row.ts, kind: row.kind || "info", action: row.action || "",
    message: row.message || "", source: row.source || "", count: Number(row.count) || 0,
    status: row.status || "info", detail,
  };
}

/* Read the most recent events, newest first. A small LIMIT keeps the payload
   light — the log is a rolling history, not an unbounded audit archive. */
export async function getActivity(limit = 500) {
  const n = Math.max(1, Math.min(5000, Number(limit) || 500));
  const res = await db().execute({ sql: "SELECT * FROM activity ORDER BY ts DESC LIMIT ?", args: [n] });
  return res.rows.map(rowToEvent);
}

/* Append one event. Idempotent on id (INSERT OR REPLACE) so a retried POST can't
   duplicate a row. The detail object is JSON-stringified into the text column. */
export async function appendActivity(ev) {
  if (!ev || typeof ev !== "object") return 0;
  const placeholders = ACTIVITY_COLUMNS.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO activity (${ACTIVITY_COLUMNS.join(", ")}) VALUES (${placeholders})`;
  const args = ACTIVITY_COLUMNS.map((c) => {
    if (c === "detail") return ev.detail == null ? null : JSON.stringify(ev.detail);
    if (c === "count") return Number(ev.count) || 0;
    return ev[c] ?? null;
  });
  await db().execute({ sql, args });
  return 1;
}

/* ---- claim history ---- */

/* Turn a stored claims row back into the record shape the app builds in
   handleSaveClaim (src/PartsIndex.jsx), parsing the cfg/rows JSON blobs
   (tolerating a malformed one rather than throwing). */
function rowToClaim(row) {
  let cfg = {}, rows = [];
  if (row.cfg) { try { cfg = JSON.parse(row.cfg); } catch { cfg = {}; } }
  if (row.rows) { try { rows = JSON.parse(row.rows); } catch { rows = []; } }
  return {
    id: row.id, savedAt: row.saved_at, claimRef: row.claim_ref || "",
    workshop: row.workshop || "", plate: row.plate || "", make: row.make || "", model: row.model || "",
    snapshotId: row.snapshot_id || "", inflPct: Number(row.infl_pct) || 0,
    invoices: Number(row.invoices) || 0, usableLines: Number(row.usable_lines) || 0,
    appVersion: row.app_version || "", generatedAt: row.generated_at || "",
    cfg, rows,
  };
}

/* Read the most recent saved claims, newest first. Mirrors getActivity: a
   small LIMIT keeps the payload light on the shared backend. */
export async function getClaims(limit = 200) {
  const n = Math.max(1, Math.min(1000, Number(limit) || 200));
  const res = await db().execute({ sql: "SELECT * FROM claims ORDER BY saved_at DESC LIMIT ?", args: [n] });
  return res.rows.map(rowToClaim);
}

/* Save (insert or replace) one claim. Idempotent on id, like appendActivity —
   a retried POST just rewrites the same row. cfg/rows are JSON-stringified
   into their text columns. */
export async function saveClaim(c) {
  if (!c || typeof c !== "object" || !c.id) return 0;
  const placeholders = CLAIM_COLUMNS.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO claims (${CLAIM_COLUMNS.join(", ")}) VALUES (${placeholders})`;
  const camel = { claim_ref: "claimRef", snapshot_id: "snapshotId", infl_pct: "inflPct",
    usable_lines: "usableLines", app_version: "appVersion", generated_at: "generatedAt", saved_at: "savedAt" };
  const args = CLAIM_COLUMNS.map((col) => {
    if (col === "cfg") return JSON.stringify(c.cfg || {});
    if (col === "rows") return JSON.stringify(c.rows || []);
    const key = camel[col] || col;
    return c[key] ?? null;
  });
  await db().execute({ sql, args });
  return 1;
}

/* Delete one claim by id. */
export async function deleteClaim(id) {
  if (!id) return 0;
  await db().execute({ sql: "DELETE FROM claims WHERE id = ?", args: [id] });
  return 1;
}

/* ---------------------------------------------------------------------------
   Write authorisation.

   A destructive write (mode:"replace", which DELETEs every row before
   re-inserting) must carry a shared secret that lives only in the server
   environment and in the operator's CLI. The browser bundle never holds it:
   anything shipped to the client is readable in devtools, so a token baked
   into the app would authorise exactly the people it is meant to stop.

   Fails CLOSED. If PARTS_WRITE_TOKEN is unset the answer is "no", never "yes" —
   the opposite default is how an endpoint quietly stays open after a config
   change. Comparison is length-safe but not constant-time; the secret is a
   deployment credential, not a per-user password, and Vercel terminates TLS
   in front of it.                                                           */
export function authorised(req) {
  const expected = process.env.PARTS_WRITE_TOKEN;
  if (!expected) return false;
  const got = (req && req.headers && req.headers["x-parts-token"]) || "";
  return typeof got === "string" && got.length === expected.length && got === expected;
}

/* Snapshot the current parts table before a destructive write.

   replaceDataset() is unrecoverable on its own: the DELETE and the re-INSERT
   share one transaction, so a caller that posts an empty or malformed array
   leaves nothing behind. This keeps the previous contents as a JSON blob in
   meta, keyed by timestamp, so a bad replace can be undone by hand. Only the
   most recent RETAINED_SNAPSHOTS are kept — the dataset is ~1.5k rows, small
   enough to store whole and far too valuable to store not at all.           */
export const RETAINED_SNAPSHOTS = 5;

export async function snapshotDataset() {
  const { rows } = await db().execute("SELECT * FROM parts");
  const key = `snapshot:${new Date().toISOString()}`;
  await db().execute({
    sql: "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
    args: [key, JSON.stringify(Array.from(rows))],
  });
  const { rows: keys } = await db().execute(
    "SELECT key FROM meta WHERE key LIKE 'snapshot:%' ORDER BY key DESC"
  );
  const stale = Array.from(keys).slice(RETAINED_SNAPSHOTS).map((r) => r.key);
  if (stale.length) {
    await db().batch(stale.map((k) => ({ sql: "DELETE FROM meta WHERE key = ?", args: [k] })), "write");
  }
  return { key, rows: Array.from(rows).length, pruned: stale.length };
}
