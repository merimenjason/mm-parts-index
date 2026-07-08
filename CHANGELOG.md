# Changelog

Versions reconstructed from the development history (dates approximate).

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
