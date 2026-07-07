# Changelog

Versions reconstructed from the development history (dates approximate).

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
