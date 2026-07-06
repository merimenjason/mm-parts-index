# Changelog

Versions reconstructed from the development history (dates approximate).

## Unreleased — documentation only (7 July 2026)
- **`Fable.md`**: feature roadmap — seven elaborated proposals (F1 estimate
  OCR intake for Assess, F2 chassis/VIN make-model enrichment, F3
  recency-aware benchmarks, F4 supplier scorecards, F5 matched-triples claim
  outcomes / POC#2, F6 quarterly chained price index, F7 shareable read-only
  benchmark bundles) with sequencing relative to the 200-invoice run.
- **`OPUS_PROMPTS.md`**: gained P8–P14, one implementation prompt per
  Fable.md feature, in the existing prompt house style (real file
  touchpoints, selftest + docs + version-bump requirements, cross-prompt
  dependency notes, e.g. P8's named-prompt-id interaction with P3).
- **`HANDOVER.md`**: onboarding handover for a new developer — domain
  context, repo tour, the five core concepts (pipeline, clustering,
  statistics, trust machinery, eval harness), house rules, common tasks,
  known warts, glossary.
- `README.md` and `MANUAL.md` link the new docs; no code changed, version
  unchanged.

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
