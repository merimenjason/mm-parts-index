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
const EVENTS_KEY = "partsindex_activity_v1"; // persistent ingest/activity log
const EVENTS_CAP = 500;                      // keep the most recent N events
const SEEDED_KEY = "partsindex_seeded_v1";  // "this browser has held data" marker (localStorage build only)

/* ---- "has this browser ever held data?" marker (localStorage build) ----
   Set on the first successful dataset save (real import/OCR) AND when the demo
   is auto-seeded on a genuine first run. Once set, the app must NOT silently
   reseed the demo if the dataset key later disappears (a cleared/evicted store,
   or the pre-1.12.0 silent-save-failure that started this whole investigation) —
   a returning user's app opens EMPTY instead of being clobbered with demo rows.
   Only fully clearing browser storage (marker gone too) counts as a fresh run.
   Irrelevant to the shared backend, which never auto-seeds. */
export function hasSeededMarker() {
  try { return localStorage.getItem(SEEDED_KEY) === "1"; } catch { return false; }
}
export function setSeededMarker() {
  try { localStorage.setItem(SEEDED_KEY, "1"); } catch {}
}

/* ---- localStorage backend (default; browser-only build) ---- */
function localLoad() {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function localSave(ds) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ds));
    // A successful save means this browser now holds real data — mark it so a
    // future load with a missing dataset key does not reseed over the user.
    setSeededMarker();
    return { ok: true };
  } catch (e) { console.error(e); return { ok: false, error: e }; }
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

/* ---- activity log: localStorage backend ---- */
function localLoadEvents() {
  try { const v = localStorage.getItem(EVENTS_KEY); const a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function localAppendEvent(ev) {
  try {
    const arr = localLoadEvents();
    arr.unshift(ev);                                  // newest first
    localStorage.setItem(EVENTS_KEY, JSON.stringify(arr.slice(0, EVENTS_CAP)));
    return { ok: true };
  } catch (e) { console.error(e); return { ok: false, error: e }; }
}

/* ---- activity log: shared-DB backend (via /api/activity) ---- */
async function apiLoadEvents(limit = EVENTS_CAP) {
  const res = await fetch(`/api/activity?limit=${limit}`, { method: "GET" });
  if (!res.ok) throw new Error(`GET /api/activity failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.events) ? data.events : [];
}
async function apiAppendEvent(ev) {
  const res = await fetch("/api/activity", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: ev }),
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); return { ok: false, error: new Error(`POST /api/activity ${res.status}: ${t}`) }; }
  return { ok: true };
}

export const DATA_BACKEND = BACKEND;
export const usingSharedBackend = BACKEND === "api";
// decideInit (the pure first-load decision) lives in pipeline.js so the browser
// bundle and the Node self-test share one Vite-independent implementation.

/* Returns the dataset ({ parts: [...] }) or null on first run / empty DB. */
export async function loadDataset() {
  return BACKEND === "api" ? apiLoad() : localLoad();
}

/* Persists the dataset. Returns { ok, error? } — never throws, so the app can
   surface a save failure without losing the in-memory data. */
export async function saveDataset(ds) {
  return BACKEND === "api" ? apiSave(ds) : localSave(ds);
}

/* ---- activity log API (mirrors the dataset switch) ----
   The log is an append-only stream of structured events (ingest, OCR, review,
   dataset, error) — each with an ISO timestamp and a detail blob for drill-down.
   It persists to the same backend as the dataset: localStorage by default, or
   the shared Turso DB via /api/activity. Events survive reloads and (on the
   shared backend) are visible to every user of the reference. */
export async function loadEvents(limit = EVENTS_CAP) {
  return BACKEND === "api" ? apiLoadEvents(limit) : localLoadEvents();
}
export async function appendEvent(ev) {
  return BACKEND === "api" ? apiAppendEvent(ev) : localAppendEvent(ev);
}
