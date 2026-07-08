/* ============================================================================
   Client-side data source — one switch between two persistence backends.

   The app calls loadDataset()/saveDataset() and does not care where the data
   lives. Which backend is used is decided ONCE, at build time, by an env flag:

     VITE_DATA_BACKEND = "api"          → shared Turso DB via /api/parts
     VITE_DATA_BACKEND = "local" (default) → browser localStorage (unchanged)

   This keeps the static GitHub Pages build (no server) working exactly as
   before, while a Vercel deployment with the DB configured flips to the shared
   backend without touching any component code.

   The browser never sees the Turso token: in "api" mode it only ever fetches
   the same-origin /api/parts endpoint, which holds the credentials server-side
   (see api/_db.js and api/parts.js).
   ========================================================================== */

const BACKEND = (import.meta.env.VITE_DATA_BACKEND || "local").toLowerCase();
const KEY = "partsindex_dataset_v3";

/* ---- localStorage backend (default; browser-only build) ---- */
function localLoad() {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function localSave(ds) {
  try { localStorage.setItem(KEY, JSON.stringify(ds)); return { ok: true }; }
  catch (e) { console.error(e); return { ok: false, error: e }; }
}

/* ---- API backend (shared Turso DB via the serverless endpoint) ---- */
async function apiLoad() {
  const res = await fetch("/api/parts", { method: "GET" });
  if (!res.ok) throw new Error(`GET /api/parts failed: ${res.status}`);
  const data = await res.json();
  // Empty DB → return null so the app seeds the demo, matching localStorage's first-run contract.
  return Array.isArray(data.parts) && data.parts.length ? data : null;
}
async function apiSave(ds) {
  const res = await fetch("/api/parts", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "replace", parts: ds.parts || [] }),
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); return { ok: false, error: new Error(`POST /api/parts ${res.status}: ${t}`) }; }
  return { ok: true };
}

export const DATA_BACKEND = BACKEND;
export const usingSharedBackend = BACKEND === "api";

/* Returns the dataset ({ parts: [...] }) or null on first run / empty DB. */
export async function loadDataset() {
  return BACKEND === "api" ? apiLoad() : localLoad();
}

/* Persists the dataset. Returns { ok, error? } — never throws, so the app can
   surface a save failure without losing the in-memory data. */
export async function saveDataset(ds) {
  return BACKEND === "api" ? apiSave(ds) : localSave(ds);
}
