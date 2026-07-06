# PartsIndex v1.8.0 — Opus implementation prompts

Paste each prompt into Opus **run from the repo root** so it can read the real
files. Standing conventions it must follow (already true of the codebase): pure
logic lives in `src/pipeline.js` (browser-free; imported by the app, the eval
harness and `tools/batch-ocr.mjs`), every new pure function gets assertions in
`tools/selftest.mjs`, `npm run test:tools` and `npm run build` must pass before
finishing, docs are updated in the same change, and `package.json` version is
bumped (patch for fixes, minor for features).

Order: P1 → P2 are pre-run and P2 depends on P1 plus your labeled gold set.
P3 and P4 are pre-run and independent. P5–P7 are post-run.

---

## PRE-RUN

### P1 — Fix the front/rear positional false merge in the matcher

```
You are working on PartsIndex v1.8.0, a React/Vite motor-parts benchmarking
tool. All matching logic is in src/pipeline.js. The stopword list is:

  export const STOP = new Set(["assy","assembly","unit","fr","frt","front",
    "rh","lh","l","r","w","o","the","of","for","with","09","and"]);

CONFIRMED BUG (documented in eval/README.md and MANUAL.md §9): front-axis
tokens (fr, frt, front) are stripped before scoring, so
"WEATHERSTRIP, HOOD" vs "WEATHERSTRIP, HOOD, FR" scores similarity 1.0 and
merges at every threshold — a permanent false merge no threshold can undo.
The list is also asymmetric: rear/rr/re are NOT stopwords, and
"DOOR PANEL FRONT" vs "DOOR PANEL REAR" scores 0.667, above the 0.65 default.

LABELING POLICY (settled — see eval/README.md): LH/RH mirror variants ARE the
same part for pricing purposes, so continuing to strip side tokens
(rh, lh, l, r) is deliberate and must be preserved. Only the AXIS
(front vs rear) distinguishes different parts.

TASK:
1. Remove "fr", "frt", "front" from STOP. Implement an AXIS-CONFLICT VETO in
   src/pipeline.js: extract a position signature from each raw part name
   BEFORE stopword removal, normalising spellings (FR/FRT/FRONT → front;
   RR/RE/REAR → rear; also UPR/UPPER vs LWR/LOWER, and INR/INNER vs OTR/OUTER
   — the eval README's ball-joint INR case shows inner/outer matters too).
   Export the extractor as a pure function (e.g. positionSignature(name)).
2. Apply the veto in BOTH merge paths — the hybrid bridge loop and
   fuzzyAgglomerate in buildClusters — exactly like the existing gradeConflict
   and unit_basis guards: if two candidates have CONFLICTING values on the
   same dimension, never merge; a missing/unknown value on either side never
   blocks. Also apply it in matchLine (src/PartsIndex.jsx, ~line 1027) so an
   Assess-a-Claim estimate line for a REAR part never matches a FRONT cluster.
3. Tokenisation care: treat FR/RR/RE only as standalone tokens, never inside
   part numbers or words ("FRAME" must not read as front; "RE" only when a
   standalone token). Write the regexes accordingly and test them.
4. Extend tools/selftest.mjs: (a) HOOD WEATHERSTRIP vs HOOD WEATHERSTRIP FR
   must NOT merge at any threshold; (b) DOOR PANEL FRONT vs DOOR PANEL REAR
   must not merge; (c) MIRROR LH vs MIRROR RH still merge (side policy);
   (d) BUMPER FRT vs BUMPER FRONT (spelling variants, same axis) still merge;
   (e) names with no position token merge as before; (f) FRAME/RE-in-word
   false-positive guards; (g) BALL JOINT ASSY-INR vs plain BALL JOINT ASSY do
   not merge (inner/outer veto).
5. Re-run the eval worked example (node eval/evaluate.mjs
   eval/gold_pairs.example_labeled.csv) and report the precision change at
   threshold 0.65 / tokenWeight 0.6 before vs after. Do NOT change the shipped
   threshold in this task.
6. While in pipeline.js, fix the stale comment "---- hybrid (default) ----":
   the app's shipped default is fuzzy-name (src/PartsIndex.jsx cfg state);
   hybrid is the recommended mode as volume grows. Say that.
7. Update MANUAL.md: rewrite the "Known matcher issues" subsection in §9 to
   mark issue 1 fixed and describe the veto in §3; note the change in
   CHANGELOG.md. Bump the minor version everywhere APP_VERSION appears.
npm run test:tools and npm run build must pass.
```

### P2 — Calibrate the matcher threshold on the labeled gold set

```
You are working on PartsIndex (v1.9+, after the axis-veto fix). The eval
harness is eval/generate_pairs.mjs + eval/evaluate.mjs; it imports the
production src/pipeline.js directly. eval/gold_pairs.csv holds 138 candidate
pairs; the label column must be human-filled with y/n/? per the policy in
eval/README.md (LH/RH = y; front vs rear = n; sub-component vs assembly = n).

PRECONDITION: count the labeled rows in eval/gold_pairs.csv. If fewer than
120 of the 138 have a y/n label, STOP and report that labeling is incomplete —
do not fabricate labels and do not calibrate on the example file.

TASK (once labels exist):
1. Run node eval/evaluate.mjs and capture the full sweep (thresholds
   0.40–0.95, token weights 0.4/0.6/0.8) into eval/results.csv.
2. Choose the operating point from the DISPUTE-GRADE row (max recall at
   precision ≥ 95%), not max-F1 — this benchmark is used to challenge repairer
   estimates, so a false merge (wrong median) costs more than a false split
   (thin median). If no setting reaches 95% precision, report that and
   recommend Hybrid mode as the default instead of raising the threshold.
3. Apply the chosen threshold and tokenWeight as the shipped defaults: the
   cfg useState in src/PartsIndex.jsx (~line 116) and any place the Benchmark
   tab resets to defaults.
4. Add a selftest asserting the shipped default equals the calibrated value,
   with a comment recording the eval date, gold-set size, and the
   precision/recall at that point — so a future edit forces re-calibration.
5. Write eval/RESULTS.md: methodology, gold-set size and label date, the
   sweep table, the chosen operating point, and one paragraph of
   justification written for a non-technical claims stakeholder. Link it from
   MANUAL.md §9 and eval/README.md, and update the "Matcher calibration is
   pending" limitation in both MANUAL.md and README.md to reflect completion.
6. CHANGELOG.md entry; minor version bump. Tests and build must pass.
```

### P3 — Harden the OCR proxy (api/ocr.js)

```
You are working on PartsIndex v1.8.0. api/ocr.js is a 32-line Vercel
serverless function that forwards req.body verbatim to the Anthropic
/v1/messages endpoint with the server-side key. It is completely open: no
origin check, no auth, no model or max_tokens limits, no body-size cap —
anyone with the URL can run arbitrary prompts on any model at the key
owner's expense. The frontend caller is ocrFile() in src/PartsIndex.jsx
(~line 55); tools/batch-ocr.mjs calls the API directly with its own key and
must remain unaffected.

TASK:
1. Server-side allowlists in api/ocr.js:
   - model must be one of the four ids in OCR_MODELS (src/PartsIndex.jsx) —
     duplicate the list into a small shared module (e.g. src/ocrModels.js)
     imported by both, so there is one source of truth;
   - cap max_tokens at 8000; reject bodies over ~30 MB (fits one base64 PDF
     under the 32 MB request cap) with a clear JSON error;
   - reject any body whose messages contain anything other than the expected
     single user turn with document/image + text blocks, and force the system
     prompt server-side to OCR_SYS from src/ocrPrompt.js — the proxy then
     cannot be used as a general Claude gateway even with a valid key.
2. Shared-secret header: require x-partsindex-key matching a
   PARTSINDEX_PROXY_KEY env var, compared in constant time
   (crypto.timingSafeEqual on hashed values). If the env var is unset, log a
   warning and allow (so local/demo deployments keep working) — document this
   default clearly. The frontend gets a small "Proxy key" input on the Ingest
   tab's OCR card, persisted to localStorage like the model picker, and sends
   the header on every /api/ocr call. Show a distinct, actionable error state
   when the proxy rejects the key (vs an upstream API error).
3. Origin allowlist from an ALLOWED_ORIGINS env var (comma-separated); when
   set, reject other Origins and answer the CORS preflight accordingly.
4. Per-instance in-memory token bucket (e.g. 30 requests/5 min per IP).
   Document honestly that serverless instances are ephemeral so this only
   bounds abuse per warm instance — the shared secret is the real gate.
5. Be explicit in code comments and docs that the shared secret is a
   DETERRENT for a POC, not real auth: it is visible in the browser to anyone
   who has app access. Recommend per-user auth as the production path.
6. Docs: README deployment section (new env vars, setup order), MANUAL.md §9
   (replace the "proxy is unauthenticated" limitation with the new posture),
   .env.example (add the two new vars), CHANGELOG.md. Test offline against
   tools/mock-server.mjs where applicable; add selftests for any pure helpers
   (model allowlist check, body shape check). Minor version bump; tests and
   build must pass.
```

### P4 — localStorage quota guard and storage meter

```
You are working on PartsIndex v1.8.0. Persistence is in src/PartsIndex.jsx:
loadDS()/saveDS() read/write JSON under KEY="partsindex_dataset_v3" via
localStorage; saveDS's catch only does console.error(e), so on quota
exhaustion the user silently loses persistence — the app keeps running on
in-memory data that vanishes on refresh. A 200-invoice dataset plus the
review queue approaches the ~5 MB quota. Do NOT migrate storage engines in
this task.

TASK:
1. Extract persistence into a new pure-ish module src/storage.js exposing:
   estimateBytes(obj) (pure — JSON byte length via a UTF-8 length count, no
   browser APIs so it is selftest-able), loadDataset(), saveDataset(ds), and
   getStorageInfo() (used bytes for our keys, a conservative 5 MB assumed
   quota, percent). Route every localStorage access for the dataset and the
   review queue through it; the model-picker and proxy-key keys can stay
   where they are.
2. saveDataset must serialize once, size-check, then write inside try/catch
   handling all QuotaExceededError spellings (name === "QuotaExceededError",
   legacy code 22 / 1014, Firefox NS_ERROR_DOM_QUOTA_REACHED). On failure
   return { ok:false, bytes } — never throw to the caller.
3. UI: when a save fails, show a persistent, dismissible amber banner (reuse
   the app's AMBER/PANEL palette constants): data is intact in memory but NOT
   saved — export to Excel now and avoid refreshing; include an Export button
   wired to the existing exportXlsx. Add a storage meter line to the Ingest
   tab (used / ~quota, %) that turns amber at 70%.
4. Add schemaVersion: 4 to the persisted payload ({ schemaVersion, parts })
   and accept both the current bare shape and the new one on load (bare =
   version 3). Keep KEY unchanged so existing users' data survives; the
   existing upgradePart() migration continues to run per part.
5. Selftests for estimateBytes, the version-detection load logic (feed it
   both payload shapes as plain objects), and the quota-error classifier
   (construct DOMException-like objects). Docs: update the localStorage
   limitation in README.md and MANUAL.md §9 to describe the meter and the
   failure banner; CHANGELOG.md. Minor version bump; tests and build pass.
```

---

## POST-RUN

### P5 — GST-normalised, date-aware price comparability

```
You are working on PartsIndex (post-200-invoice run). MANUAL.md §9 flags the
gap: bills span multiple years and mixed GST treatment, yet medians treat all
prices as directly comparable. Every line already carries gst
(incl/excl/unknown, invoice-level) and the OCR extracts gst_amount and
parts_subtotal. Singapore GST: 7% until 31 Dec 2022, 8% during 2023, 9% from
1 Jan 2024. Also relevant: parseDate() in src/pipeline.js only parses
D/M/YYYY with slashes — bills printed as 04.10.2018, 04-10-2018 or 2018-10-04
currently lose their date, which would break date-aware GST and the trend
view.

TASK:
1. Harden parseDate() to also accept dot and dash separators and ISO
   YYYY-MM-DD, keeping the existing DD/MM assumption for ambiguous forms
   (SG convention). Selftest each format plus a 2-digit year.
2. Add to src/pipeline.js: GST_SCHEDULE (ordered [{from:"2007-07-01",rate:7},
   {from:"2023-01-01",rate:8},{from:"2024-01-01",rate:9}] as data) and pure
   gstRateFor(dateObj|string) using parseDate; unknown/unparseable date
   falls back to the CURRENT rate and the caller flags it.
3. Add exGstUnit(part): if gst === "excl" or "unknown", the unit price is
   already treated as ex-GST (unknown flagged); if "incl", divide by
   (1 + rate/100) using the bill-date rate. Attach { unit_ex, gst_flag } in
   enrichPart and upgradePart so persisted datasets migrate.
4. Benchmarks: add a cfg toggle "GST-normalised prices" (default ON) that
   makes buildClusters use unit_ex instead of unit. Fold the toggle into the
   snapshot config (it changes every number, so it must change the snapshot
   id — verify configFingerprint picks it up automatically) and show the
   basis ("prices ex-GST" / "prices as billed") in the dispute-pack Summary
   and the Benchmark tab caption. Lines with gst_flag (unknown treatment or
   unparseable date) get a small marker in drill-downs.
5. Selftests: boundary dates (31 Dec 2022 / 1 Jan 2023 / 31 Dec 2023 /
   1 Jan 2024), incl→ex conversion at each rate, unknown-treatment
   passthrough with flag, snapshot id changes when the toggle flips.
6. Docs: MANUAL.md (new subsection under Data quality & validation; remove
   the §9 comparability limitation), README feature list, OCR_PROMPT.md
   unchanged (it already extracts gst fields), CHANGELOG.md. Minor bump;
   tests and build pass.
```

### P6 — Decompose src/PartsIndex.jsx into modules

```
You are working on PartsIndex. src/PartsIndex.jsx is ~1,230 lines holding the
palette constants, persistence glue, OCR fetch, Excel parsing, App state, and
~25 components (Dashboard, DemoLookup+Worklist with jspdf export, Ingest,
Ledger, Benchmark, Assess, eight M* analytics views, Coverage, MethodNotes,
shared Card/ExpandTable/KpiDetail pieces). Pure logic already lives in
src/pipeline.js and src/ocrPrompt.js — extend that discipline to the UI.

TASK — structural refactor with ZERO behavior change:
1. Propose the layout first, then execute: src/theme.js (palette constants +
   shared style helpers like btn), src/excelImport.js (col/parseExcel),
   src/ocrClient.js (ocrFile/fileToB64), src/tabs/<Tab>.jsx one per tab,
   src/components/ for Card, ExpandTable, PartLines, QuoteLines, KpiDetail,
   Head. Keep src/pipeline.js and src/storage.js (if P4 landed) untouched.
   App.jsx keeps state and passes props exactly as today — do not introduce
   context/stores or new dependencies.
2. Migrate one tab at a time, running npm run build after each move. Pure
   moves only: no renames of user-visible strings, no restyling, no logic
   "improvements", so a reviewer can verify each diff is a relocation.
3. Preserve the localStorage keys, persisted payload shape, dynamic
   import("jspdf") pattern (bundle size), and APP_VERSION export location.
4. Verification: npm run test:tools clean; npm run build clean; then render
   the built app headless (add a throwaway tools/dom-snapshot.mjs using
   whatever headless browser is available) and diff each tab's text content
   for the embedded demo dataset against a pre-refactor build.
5. Update the README project-structure tree and MANUAL.md references to file
   locations; CHANGELOG.md. Minor bump.
```

### P7 — Persist benchmark snapshots (reproducibility beyond localStorage)

```
You are working on PartsIndex. MANUAL.md §9 states the gap: every dispute
pack carries a snapshot id (PIX-<dataHash>-<cfgHash>, FNV-1a — see
snapshotId/datasetFingerprint/configFingerprint in src/pipeline.js), but past
snapshots are not stored, so regenerating an old pack requires the dataset
exactly as it stood. localStorage (~5 MB) cannot hold snapshot history.

TASK:
1. Migrate dataset persistence from localStorage to IndexedDB via a small
   hand-rolled wrapper (no new dependencies): db "partsindex", stores
   "dataset" (current parts, schemaVersion) and "snapshots"
   (key = snapshot id; value = { createdAt, cfg, parts, appVersion, note }).
   On first load, migrate any existing localStorage dataset in, then leave a
   tombstone so migration runs once; keep a localStorage fallback path for
   environments without IndexedDB.
2. Record a snapshot automatically whenever a dispute pack or a Worklist
   export is generated (those are the moments a number leaves the app), and
   allow a manual "Save snapshot" with a note. Cap history (e.g. most recent
   40 snapshots, oldest evicted) and show usage.
3. New "Snapshots" panel (inside Ingest or a small new tab): list id, date,
   note, invoice/line counts; actions = load read-only into a viewer that
   re-runs buildClusters with the stored cfg and marks the UI "viewing
   snapshot PIX-… (read-only)", export that snapshot's benchmark to Excel,
   delete. Loading a snapshot must NEVER overwrite the live dataset without
   an explicit confirmed "restore" action.
4. Integrity: on load, recompute snapshotId(parts, cfg) and verify it matches
   the stored key; surface a mismatch loudly (it means corruption).
5. Selftests for the pure parts (eviction policy, integrity check against
   fixture data). Storage failure handling mirrors P4's banner pattern.
6. Docs: MANUAL.md (new subsection; delete the §9 limitation; update §7's
   localStorage description), README data-model section (localStorage →
   IndexedDB in the progression note), CHANGELOG.md. Minor bump; tests and
   build pass.
```
