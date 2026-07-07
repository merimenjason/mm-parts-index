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

export const SCHEMA_VERSION = 1;

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
    // Indexes for the app's common lookups (make filter, PN search, dedup).
    `CREATE INDEX IF NOT EXISTS idx_parts_make ON parts(make)`,
    `CREATE INDEX IF NOT EXISTS idx_parts_npn  ON parts(npn)`,
    `CREATE INDEX IF NOT EXISTS idx_parts_bill ON parts(supplier, bill_no)`,
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
