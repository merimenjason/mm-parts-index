# Changelog

Versions reconstructed from the development history (dates approximate).

## 1.12.1 — 9 July 2026

Auto-seed guard: the demo no longer silently reappears over a returning user's
data, and no longer double-logs. 103 self-tests (was 94), clean build.

- **FIXED: the demo could silently reseed over real data.** The mount effect
  seeded the 18-bill demo whenever `loadDataset()` returned nothing — including
  when a browser that *had* held data lost its `partsindex_dataset_v3` key
  (cleared/evicted store, or the pre-1.12.0 silent-save-failure). On the next
  load the app looked "empty" and quietly repopulated with demo rows, masking the
  data loss. A new `partsindex_seeded_v1` marker records that this browser has
  held data — set on the first successful save (`localSave`) **and** on the
  first-run seed. The load decision now has four outcomes (see `decideInit` in
  `src/pipeline.js`): use the stored dataset; start empty on the shared backend;
  start **empty for a returning browser** whose dataset key is missing but whose
  marker is set (the new guard — no reseed); or seed once on a genuine first run
  (no dataset **and** no marker). Only fully clearing browser storage counts as a
  fresh run. An explicitly-empty `{parts:[]}` (e.g. after **Clear dataset**) is
  honoured as real state and never triggers a reseed.
- **FIXED: first-run seed logged twice, one second apart.** React
  `StrictMode` (dev) double-invokes mount effects, so the load/seed path ran
  twice — the origin of the paired "LOAD DEMO" rows in the activity log. A
  `didInit` ref guards the effect so it runs exactly once per real mount
  (StrictMode's second, synthetic invocation is now a no-op). Production builds
  were never double-invoked, but the guard makes the intent explicit.
- **CHANGED: the first-run seed is a distinct `Auto-seed` event, not `Load demo`.**
  Automatic seeding now logs a **dataset / Auto-seed** activity event
  (`source: "first-run"`) with a drill-down note explaining it was automatic and
  how to replace it. It can no longer be mistaken for a manual **Load demo**
  (which still logs its own event when the button is pressed).
- **decideInit is a pure, tested function.** Placed in `src/pipeline.js` (shared,
  Vite-independent) rather than `datasource.js` — which reads `import.meta.env` at
  module load and so can't be imported by the Node self-test. Nine new assertions
  in `tools/selftest.mjs` cover all four outcomes plus the malformed-blob and
  explicitly-empty edge cases.
- Docs (README, MANUAL, HANDOVER, OPUS_PROMPTS) updated to describe the once-only
  seed, the marker, and the returning-user guard.

## 1.12.0 — 8 July 2026

Full code review release: two data-loss bugs fixed, the P1 matcher false-merge
closed, the OCR pipeline hardened end-to-end, and the repo cleaned of stale
duplicates. 94 self-tests (was 72), clean build.

- **FIXED (data loss): multi-file ingestion kept only the last file.** `addRaw`
  and the OCR duplicate gate closed over the `ds` snapshot from the render the
  handler was created in, so a single selection of several Excel files or
  invoices rebuilt every commit from the SAME stale dataset — each file
  overwrote the previous one's lines instead of appending. `commit()` now
  accepts a functional updater resolved against a synchronously-maintained
  `dsRef`, and both `addRaw` and the dedup gate use it. Selecting N files now
  ingests N files.
- **FIXED (silent data loss): failed dataset saves are now surfaced.** `commit`
  fire-and-forgot `saveDS`; a localStorage quota failure or a failed
  `POST /api/parts` only reached the console, leaving the app running on
  in-memory data that vanished on refresh. A failed save now logs a visible
  **error event** ("data shown is in memory only and will be lost on reload")
  with the backend and cause. (The P4 storage meter remains open.)
- **FIXED (P1): positional false merges in the matcher.** `fr/frt/front/rh/lh/l/r`
  are stripped as stopwords before similarity scoring, so `COVER FR` vs
  `COVER RH`-style pairs scored 1.0 and merged at every threshold. New
  `posKey()` extracts a positional signature from the RAW name (standalone
  tokens only — `FRAME` never reads as front), and `posConflict()` vetoes a
  merge on any conflicting axis: **front/rear, upper/lower, inner/outer always
  block**; **LH/RH blocking is a new opt-in** (`cfg.sepSide`, "Separate LH / RH"
  checkbox — default off per the settled labeling policy: side counterparts are
  price-identical and pool). Applied in the hybrid bridge loop,
  `fuzzyAgglomerate`, AND `matchLine` (an estimate's rear part can no longer
  match a front cluster). The dispute-pack summary discloses both settings.
  Deviation from the P1 prompt: positional stopwords stay in STOP (spelling
  variants like `FRT` vs `FRONT` on the same axis should still merge); the veto
  supersedes removal. `eval/evaluate.mjs` now replays the veto before the
  threshold, honouring its "scores the exact code the app runs" contract —
  metrics on the worked example are unchanged because its residual false
  positives are known-vs-unmarked pairs, which the veto deliberately leaves to
  threshold calibration (P2).
- **FIXED: OCR failures now say what actually failed.** `ocrFile` parsed the
  response body without checking `res.ok` or `stop_reason`, so a proxy error or
  an output truncated at the token ceiling surfaced as a cryptic
  "Unexpected end of JSON input". It now throws the upstream error message,
  detects `max_tokens` truncation explicitly (same guard added to both paths of
  `tools/batch-ocr.mjs`), and the default output budget rises 4000 → 8192.
- **CHANGED (policy): struck-through / returned lines follow the arithmetic.**
  The OCR prompt excluded every struck-through/returned line; when the printed
  subtotal still counted such a line, the reconciliation gate false-failed. The
  rule is now: include the line if its amount is still counted in the printed
  totals; exclude only when the totals demonstrably exclude it.
- **HARDENED: the OCR proxy constrains what a caller can spend.** `api/ocr.js`
  forwarded arbitrary bodies with the server's key. It now whitelists the four
  Ingest-tab models, caps `max_tokens` at 16 384, validates the body, and
  supports an optional `OCR_PROXY_TOKEN` / `VITE_OCR_PROXY_TOKEN` shared secret
  (a drive-by tripwire, not real auth — P3 stays open).
- **FIXED: Excel date cells ingested as serial numbers.** A true date cell
  arrives from SheetJS as a serial (e.g. `45678`); it is now formatted to
  `dd/mm/yyyy` at parse. `parseDate` additionally accepts ISO `YYYY-MM-DD`, so
  shared-DB round-trips render evidence date ranges instead of "—".
- **Repo hygiene.** Deleted the stale v1.5.0 duplicates at the repo root
  (`PartsIndex.jsx`, `pipeline.js`, `demoData.js`, `ocrPrompt.js`, `main.jsx`,
  `index.css`, root favicon/screenshot copies) — the build uses `src/` and
  `public/`; the root copies were dead code one careless edit away from
  shipping a regression. Removed a committed Vite timestamp artifact, added the
  missing `.gitignore`, and created the `.env.example` and
  `.github/workflows/deploy-pages.yml` the README documented but the repo
  lacked.
- Stale `---- hybrid (default) ----` comment corrected (shipped default is
  fuzzy-name); 22 new self-test assertions (positional guard, tokenisation
  false-positive guards, sepSide behavior, parseDate forms).

## 1.11.2 — 8 July 2026
- **Make canonicalisation — "Mercedes" now shows as "Mercedes-Benz".** The make
  inferred at ingest was trusted verbatim from the bill, so variants like
  `Mercedes`, `MERCEDES BENZ` or `Merc` were stored as-is and never matched the
  Dashboard/Coverage make list (which keys on the exact canonical string) — the
  make appeared split off or absent. New `canonMake()` in `src/pipeline.js` folds
  every make onto its canonical spelling (case/punctuation-insensitive, plus
  aliases: Mercedes/Merc/Benz/MB → **Mercedes-Benz**, VW → Volkswagen,
  Chevy → Chevrolet, …); `Mitsubishi` and `Mitsubishi Fuso` stay distinct, and an
  unlisted make is returned untouched. Applied in `inferMake` (so a supplied make
  is canonicalised, not trusted raw) **and** in `upgradePart`, so datasets already
  persisted with a non-canonical make are **re-folded on load** (localStorage and
  shared-DB builds alike) — and, as a bonus, a make stored as `Unknown` is
  recovered from the part-number prefix. 13 new self-test assertions cover it.

## 1.11.1 — 8 July 2026
- **Ingest layout: Activity and Dataset actions now share a row.** The persistent
  activity log dropped its full-width (`span="1 / -1"`) treatment and moved up to
  sit in the **left** column of the Ingest `.pi-2col` grid, with **Dataset
  actions** (Load demo / Export / Clear) now to its **right** on the same row.
  Below 760px the two-column grid still collapses to a single column (activity
  above dataset actions), so the change is desktop-only. No behavioural change to
  either panel.

## 1.11.0 — 8 July 2026
- **Persistent, drill-downable activity log.** The Ingest tab's *Activity* panel
  is no longer an ephemeral in-memory list wiped on reload. Every ingest, OCR,
  review and dataset action is now recorded as a **structured event** — machine
  timestamp (date **and** time), kind, action, status, affected line count, the
  originating file/bill, and a JSON **detail** blob — and **persisted** to the
  same backend as the dataset:
  - **localStorage** by default (new `partsindex_activity_v1` key, rolling
    cap of 500 events).
  - the shared **Turso / libSQL** database when `VITE_DATA_BACKEND=api`, so the
    history survives reloads and is visible to every user of the reference.
  - New `activity` table in `api/_db.js` (`SCHEMA_VERSION` bumped to **2**;
    `getActivity` / `appendActivity`, idempotent on event id) and a new
    `api/activity.js` endpoint (`GET /api/activity?limit=` → `{ events }`,
    `POST` appends one event). `src/datasource.js` gains `loadEvents()` /
    `appendEvent()`, mirroring the dataset backend switch.
  - Each log row **expands** to a full drill-down: exact date & time, event,
    status, source, parts affected, plus the detail captured for that action —
    for OCR that includes the **Claude model used**, the **reconciliation**
    outcome (extracted line sum vs printed total, basis and difference) and
    whether the bill was held for review; for imports, the **suppliers / makes /
    bills** touched; for review actions, the bill and line count. A kind filter
    (All / Ingest / OCR / Review / Dataset / Error) sits above the list.
- **Sortable table headers on every tab.** Clicking any column header now sorts
  that table **A→Z**, and again for **Z→A**, with a ▲/▼ indicator on the active
  column (an idle **⇅** hint on the rest). A shared `useSort` hook + `SortTh`
  header + numeric-aware comparator (it reads through `S$`, `%`, `+` and `≈`
  prefixes so money and percentages sort as numbers, text sorts alphabetically)
  power it. Wired into the **Parts Ledger**, **Benchmark**, **Demo** results and
  worklist tables, **Assess a Claim** results, the Analytics `ExpandTable` (so
  all of Inflation / Confidence / Dispersion / Agreement / Accuracy /
  Normalisation sort), the Analytics median-benchmark table, and every
  Dashboard **KPI drill-down** table. Sorting a table collapses any open
  drill-down row so the expanded evidence always matches the row above it;
  tables keep their existing default order until a header is clicked.

## 1.10.0 — 7 July 2026
- **Wider reliability floor range.** The *Min quotes for reliable spread* slider
  on the **Benchmark** tab now runs **1–30** (was 3–8); default is unchanged (4).
  1 treats every cluster with ≥1 quote as reliable; higher values are stricter
  about thin data. Only the input bounds changed — `dispersion()`'s `n >= minN`
  test and the snapshot fingerprint are untouched, so existing snapshots and the
  statistical-bound behaviour are unaffected.
- **Reliability floor is now configurable on the Demo tab too.** Added the same
  *Min quotes for reliable spread* slider (1–30, default 4) to the Demo search
  card. It writes the shared `cfg.minQuotes`, so adjusting it on Demo or Benchmark
  moves the `*` advisory markers, the IQR reliability, and the Assess statistical
  bound together — one floor across the whole app.
- **Add control moved to the leftmost column** of the Demo results table (parts
  section). The `+` / `✓` worklist toggle is now the first column instead of the
  last, so it reads before the part it acts on. Column count is unchanged (11),
  so drill-down `colSpan` values are untouched.
- **GitHub repository link in the header.** Added a *Github Repository* link with
  a GitHub mark icon in the top-right masthead, directly under *fuzzy-matched
  median benchmark*. Both the text link and the icon open
  `https://github.com/merimenjason/mm-parts-index` in a new page named
  "Github Repository" (`rel="noopener noreferrer"`).

## 1.9.2 — 7 July 2026
- **No more page-level horizontal scrolling.** Reduced the content gutter and
  made it responsive (`--pi-gutter`: 26px desktop → 14px ≤900px → 10px ≤560px),
  trimmed `Card` and tab padding, and — the main fix — wide data tables now
  scroll **within their own card** (`display:block; overflow-x:auto`) instead of
  stretching the whole page. The page body is pinned with `overflow-x:hidden`.
  Fixed two-column layouts (`1fr 1fr`) collapse to a single column below 760px
  via a new `.pi-2col` class, and grid/flex children get `min-width:0` so they
  can shrink below their content width. Verified with a headless render: zero
  page overflow across all nine tabs at 360 / 414 / 768 / 1024px, with the wide
  Ledger/Benchmark/Analytics tables remaining fully readable via contained
  in-card scroll.

## 1.9.1 — 7 July 2026
- **Shared backend starts empty; no demo auto-seed.** With `VITE_DATA_BACKEND=api`
  the app no longer seeds the 18-bill demo when the database is empty — that path
  previously would have POSTed 174 demo rows into the shared reference on the
  first browser to load it. The demo now auto-seeds **only** in the browser-only
  (localStorage) build; on the shared backend it is seeded deliberately via
  `npm run db:seed` or the in-app **Load demo** button. Real uploads/OCR continue
  to persist to libSQL through `/api/parts`.
- On the shared backend the app also no longer re-POSTs the whole dataset on
  every page load (the migration re-save is localStorage-only; the server is the
  source of truth), and a failed dataset load starts empty and logs instead of
  half-loading.
- Docs (README quickstart/features/usage, MANUAL §5/§7) updated to state the
  auto-seed is browser-only and the shared backend starts empty.

## 1.9.0 — 7 July 2026
- **Optional shared database backend (Turso / libSQL over HTTP)**. The dataset
  can now live in a shared SQLite-compatible database instead of per-browser
  `localStorage`, so one benchmark reference serves every user.
  - `api/_db.js` — libSQL client, `parts` table schema (one row per enriched
    line), and `getDataset` / `upsertParts` / `replaceDataset`. Server-only;
    holds `TURSO_AUTH_TOKEN`, never shipped to the browser.
  - `api/parts.js` — `GET` returns `{ parts:[…] }`; `POST` replaces or appends.
  - `src/datasource.js` — `loadDataset`/`saveDataset` with a build-time switch
    `VITE_DATA_BACKEND` (`local` default → localStorage, `api` → `/api/parts`).
    The app's `loadDS`/`saveDS` now delegate here; localStorage behaviour and
    the GitHub Pages build are unchanged when the flag is unset.
  - `tools/db-init.mjs` + `npm run db:init` / `db:seed` — create the schema and
    optionally seed the 18-bill demo, against `file:local.db` locally or a
    Turso URL in production.
  - Chosen over a file-based SQLite `.db` because Vercel serverless has an
    ephemeral, read-only filesystem; libSQL-over-HTTP persists writes with the
    same SQL and schema and only a URL change between local and prod.
  - Statistics deliberately remain in `src/pipeline.js` (not SQL) to preserve
    the Excel-consistent `PERCENTILE.INC`/`STDEV.S` guarantees.
  - Docs: README data-model section rewritten with the Turso path, DDL and
    enable steps; MANUAL §7 rewritten; `.env.example` documents the three new
    vars; `@libsql/client` added; `local.db` gitignored.

## 1.8.1 — 7 July 2026
- **Token-lean OCR output**: the shared OCR prompt (`src/ocrPrompt.js`) now
  instructs **minified JSON** and **omits default-valued fields** — `unit_cost`
  when no unit price is printed, `grade` when unmarked, `unit_basis` for
  per-each lines — cutting roughly 35–45% of output tokens per invoice and the
  same share of per-call latency (output generation dominates OCR wall time).
  Safe by construction: `validateInvoice` already coerced omitted fields to the
  identical defaults with zero warnings (batch-runner path), and `enrichPart`
  infers the same defaults directly (app live-OCR path, which skips the
  validator) — plus a one-line hardening so an omitted `unit_cost` with no
  line total stays `0`, never `NaN`. Six new self-test assertions cover the
  omitted-field path through both ingest routes; `OCR_PROMPT.md` documents the
  format and the rationale (including why the system prompt itself is
  deliberately *not* trimmed).
- **Documentation set**: added `Fable.md` (feature roadmap F1–F7: estimate OCR
  intake, chassis/VIN enrichment, recency-aware benchmarks, supplier
  scorecards, matched-triples claim outcomes / POC#2, quarterly price index,
  shareable benchmark bundles), `HANDOVER.md` (new-developer handover), and
  `OPUS_PROMPTS.md` P8–P14 (one implementation prompt per roadmap feature);
  README and MANUAL link the new docs.

## 1.8.0 — July 2026
- **Demo lookup tab**: stakeholder-facing benchmark search — make/model filters,
  normalisation-aware part-number search, global search, median & mean per part,
  full quote drill-down with provenance.
- **Worklist**: build a shortlist of benchmarks from Demo results (`+` /
  *Add all shown*), expandable rows, export to **Excel** (Worklist + Evidence
  sheets) and **PDF** (benchmark table + evidence table). The PDF library
  (jspdf + autotable) loads on demand so the main bundle stays lean.

## 1.7.0 — July 2026
- **Make and model everywhere**: model shown alongside make on every tab, in
  every drill-down, in the Excel export and the dispute pack; multi-model
  clusters flagged with a `+N` marker and hover list.
- Assess a Claim drill-down explains unmatched lines with the nearest rejected
  candidate and its score.

## 1.6.0 — July 2026
- **Drill-down interactivity across all tabs**: two-level KPI drill-down on the
  Dashboard, click-to-expand on every row of all eight Analytics views, Parts
  Ledger full-record panels, Coverage expansion.

## 1.5.0 — 6 July 2026
- **Dispersion statistics**: IQR (Q1–Q3), sample SD, CV per benchmark;
  Excel-consistent maths (`PERCENTILE.INC` / R-7 quantiles, `STDEV.S` n−1).
- Benchmark tab **IQR band** column, reliability floor (*Min quotes for
  reliable spread*, default 4) with `*` advisory marker; floor hashed into the
  snapshot id.
- Assess a Claim **Tukey upper fence** (Q3 + 1.5·IQR) → **ABOVE BOUND** badge,
  fence KPI tile; bound recorded in the dispute pack.
- Single-quote clusters return SD/CV as `NaN`, never 0.
- 14 new self-test assertions (quantiles vs Excel references, NaN guards,
  fences, minQuotes propagation).

## 1.4.0 — July 2026
- **Dispute pack export**: three-sheet Excel (Summary with snapshot id, Line
  Assessment, Evidence listing every underlying quote).
- **Benchmark snapshot ids** (FNV-1a over dataset + matching config) for
  reproducibility.

## 1.3.0 — 5 July 2026
- **Grade / unit-basis / GST schema fields** end to end (OCR prompt, validator,
  enrichment, clustering guards, ledger, benchmark, exports). Grade-aware
  clustering: known-but-conflicting grades never merge (*Separate grades*
  toggle); per-pair prices never join per-each medians.
- **Totals-reconciliation gate** (extracted line sum vs printed subtotal,
  S$1 / 0.5% tolerance) with an Ingest review queue and Accept/Discard actions;
  reviewed bills excluded from all benchmarks.
- **Duplicate bill detection** (supplier + bill no) at upload and in the runner.
- **Eval harness** (`eval/generate_pairs.mjs`, `eval/evaluate.mjs`) importing
  the production `pipeline.js`; labeling policy documented; surfaced the
  positional-stopword bug and threshold headroom.
- `src/pipeline.js` extracted from the React app (pure, browser-free).

## 1.2.0 — July 2026
- **OCR schema validation** (`validateInvoice`): coercible problems downgraded
  to warnings, structural problems reject the invoice before ingest.
- Stored-dataset migration (`upgradePart`) back-fills fields added since a
  dataset was persisted.

## 1.1.0 — 5 July 2026
- **Batch OCR runner** (`tools/batch-ocr.mjs`): resumable SHA-256 manifest,
  live worker-pool and Message Batches modes (50% token cost), retries,
  `--dry-run` / `--limit`, per-file token accounting, `run_report.json`,
  app-importable `PartsIndex_import.xlsx` with a Run Log sheet.
- OCR prompt extracted to `src/ocrPrompt.js` (single source of truth for app
  and runner); Claude model selector with localStorage persistence.
- Mock API server (`tools/mock-server.mjs`) and self-test suite
  (`npm run test:tools`).

## 1.0.0 — 3 July 2026
- Initial PartsIndex app: React/Vite, Merimen/Fermion branding, embedded
  174-line demo dataset (18 bills), enrichment pipeline (PN normalisation,
  make inference, categorisation, line typing), configurable fuzzy/hybrid
  matching, eight analytics views, coverage report, Excel import/export,
  live Claude OCR via the Vercel proxy, localStorage persistence.
