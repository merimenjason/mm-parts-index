# PartsIndex

**A parts-pricing reference for Singapore motor third-party (TP) claims.**
It mines motor **supplier bills** to build a credible **median benchmark** per
part, so insurers can review repairer estimates against an independent reference,
negotiate fairer offers, expedite fair claims and support disputes.

Built for the Merimen Motor Claims initiative. Branded in the Merimen / Fermion
palette (petrol-teal + lime). Ships with a **demo dataset of 18 real supplier
bills** (174 part lines) so you can explore it immediately.

![tabs: Dashboard · Demo · Ingest · Parts Ledger · Benchmark · Assess a Claim · Analytics · Coverage · Method Notes](public/screenshot.png)

---

## What it does

- **Ingest two ways** — bulk-upload Claude-OCR'd spreadsheets, or upload raw invoice PDFs/images and have Claude OCR them live.
- **Auto-enrich** — normalises part numbers, infers make/model, assigns a canonical category, and classifies each line (supplier part / consumable / estimate / labour).
- **Fuzzy-matched benchmark** — groups parts by **configurable fuzzy name matching** (not brittle exact part numbers), then computes median / average / range / quote count / suppliers per cluster.
- **Hybrid part-number-first matching** — the benchmark groups by exact (normalised) **part number** first — the identifier supplier bills carry that PeerIndex/eSource lack — then can optionally *bridge* different part numbers whose names are similar within the same make/model (OEM vs aftermarket). Same-model separation stops a Camry headlamp merging with a Hilux one, and a **Basis** column marks whether each benchmark rests on one part number (PN) or a looser name bridge (≈). Configurable on the Benchmark tab (bridging is off by default for the most defensible number).
- **Assess a Claim** — paste an incoming repairer estimate (part no · description · quoted price per line) and get a line-by-line variance report against the benchmark, with total quoted vs benchmark, **potential over-claim**, and flagged lines. This is the inverse of building the reference — it puts the reference to work on a live claim.
- **Dispute pack export** — one click turns an assessment into the attachable audit trail: an Excel with a **Summary** (claim ref, matching settings, totals, a **benchmark snapshot id**), the **Line Assessment**, and an **Evidence** sheet listing *every underlying supplier quote* behind every benchmark used (make · model · supplier · bill no · date · grade · price · source). Same snapshot id = same data + same settings, so a figure quoted in a negotiation stays reproducible after new bills shift the median.
- **Demo lookup tab + worklist** — a stakeholder-facing benchmark search: filter by make/model, part name or part number (normalisation-aware, so `52119` finds `T52119-06971`), or a global search across all fields, and read each part's **median** and **mean** unit price. Every result drills down to the underlying supplier quotes with full provenance (supplier, bill number, date, grade, and Claude-OCR vs Excel source). Add results to a **Worklist** with the `+` button and export the shortlist to **Excel** (worklist + evidence sheets) or **PDF** (a printable benchmark table); the PDF library loads on demand so it never bloats the main bundle.
- **Make _and_ model everywhere** — the vehicle **model** is shown alongside make across every tab (Benchmark, Parts Ledger, Demo, Analytics, Dashboard), in every drill-down, and in both the Excel export and the dispute pack. Clusters that legitimately span models carry a `+N` marker with a hover listing them, so the median is never quietly attributed to a single model.
- **Eight live analytics** — median benchmark, inflation flagging, confidence scoring, supplier dispersion, price trend, cross-source agreement, accuracy validation, and a normalisation view. All selectable under the **Analytics** tab.
- **Dispersion measures (IQR / SD / CV)** — every benchmark carries the interquartile range (Q1–Q3), sample standard deviation and coefficient of variation. The Benchmark tab shows an **IQR band** column (a `*` marks clusters below the reliability floor, where spread is advisory); the dispersion and confidence analytics surface SD and CV; and **Assess a Claim** flags any estimate line above the **Tukey upper fence** (Q3 + 1.5·IQR) as `ABOVE BOUND` — a statistically defensible outlier, harder to dispute than a bare percentage. A **Min quotes for reliable spread** slider (default 4) sets that floor and, since it changes which lines are flagged, is folded into the reproducibility snapshot. Quantiles use Excel's PERCENTILE.INC and SD uses STDEV.S (n−1) so every figure reconciles against a spreadsheet.
- **Quote drill-down everywhere** — click any benchmark part (Dashboard, Benchmark tab) and **any row in any of the eight Analytics views** to expand the evidence behind the number: inflation flags open the offending bill plus the full cluster, confidence scores open a component-by-component breakdown (depth / diversity / recency bars), dispersion opens the cheapest-vs-dearest gap with a grade caution, trend strips list their lines in date order, agreement rows show the verdict arithmetic, accuracy signals expand to line-level list-vs-net and per-bill provenance, and normalisation rows reveal every raw spelling that was merged. The same applies outside Analytics: **Parts Ledger** lines open their full record (GST, grade, basis, normalised PN, source, bill context) plus the benchmark they feed; **Assess a Claim** rows open the match evidence — or, for unmatched lines, the closest rejected candidate and why it fell short; **Coverage** makes/categories and the Dashboard coverage bars expand into their part lines.
- **KPI drill-down (two levels)** — click any dashboard KPI tile (Invoices, Part lines, Usable parts, Fuzzy clusters, Makes covered, Benchmark-ready) to open an inline breakdown, then **click any row in that panel** to expand the individual part lines behind it (invoice → its parts, category → its parts, make → its parts, cluster band → its clusters).
- **Coverage report** — by make and category, against the project's success criteria.
- **Loads on open + persists** — the 18-bill demo dataset loads automatically on first visit; uploads persist to the browser and reload next session; export the enriched DB + benchmark to `.xlsx`.

### How matching works

The **default** mode is **fuzzy part name** — it clusters parts whose names are
similar (token overlap + edit distance), which is what forms usable multi-quote
medians on a small dataset. For a more conservative, court-defensible basis, the
**Hybrid** mode groups by exact normalised **part number** first — the identifier
supplier bills carry that PeerIndex and eSource lack — and only merges *different*
part numbers by name when you turn **bridging** on. Keeping **Same model** on
prevents a Camry headlamp merging with a Hilux one, and every benchmark shows a
**Basis** flag: `PN` (rests on one part number) or `≈` (a name bridge). All four
modes — fuzzy name, hybrid, exact part number, and category — are selectable on
the Benchmark tab, along with similarity threshold, token-vs-spelling weight, and
same-make/same-model constraints. As real volume builds and identical part
numbers recur, prefer Hybrid.

---

### Data quality & validation

- **Grade, GST & unit-basis fields** — every line carries a parts **grade**
  (`OEM Genuine` / `OES` / `Aftermarket` / `Used/Recon` / `Unknown`), a **unit basis**
  (`each` / `pair` / `set`) and the invoice's **GST treatment**. Grade is the single
  largest legitimate price driver: the matcher **refuses to merge an OEM-genuine
  quote with an aftermarket one** (togglable via *Separate grades* on the Benchmark
  tab; Unknown grades never block a merge), and per-pair prices never join per-each
  medians. Grades come from OCR/Excel when supplied, else are inferred from name
  tags like `(ORIGINAL)`, `(TW)`, `RECON` — never guessed.
- **Totals-reconciliation gate** — every OCR'd invoice's extracted line sum is
  checked against the invoice's own printed parts subtotal (tolerance S$1 or 0.5%).
  Mismatched bills are **held for review and excluded from all benchmarks** until
  accepted or discarded in the Ingest tab's review queue. Duplicate bills
  (same supplier + bill no) are skipped at upload so quotes never double-count.
- **Gold-standard matcher evaluation** — `npm run eval:pairs` generates candidate
  part pairs for human labeling; `npm run eval:score` replays the *exact* production
  matcher over the labeled set and reports precision/recall/F1 across the full
  threshold grid, including the highest-recall setting that keeps false merges
  under 5% ("dispute-grade"). See [`eval/README.md`](eval/README.md) — the worked
  example on the demo set already surfaced a stopword bug and threshold headroom.
- **Robust, Excel-consistent dispersion** — spread is reported as **IQR** (Q1–Q3),
  sample **SD** and **CV**, chosen because parts pricing is right-skewed (IQR/median
  resist inflated quotes better than mean/SD) and CV makes spread comparable across
  cheap and expensive parts. Quantiles follow `PERCENTILE.INC` (R-7) and SD follows
  `STDEV.S` (n−1) so figures reconcile against a stakeholder's spreadsheet. A
  configurable **reliability floor** (default 4 quotes) marks thin clusters advisory
  and withholds the Tukey outlier bound from them; it is hashed into the benchmark
  snapshot id so exported figures stay reproducible after it is retuned.

---

## Quick start (local)

```bash
npm install
npm run dev        # http://localhost:5173
```

Open the app — the **18-bill demo dataset loads automatically** on first run, so
the dashboard, benchmark and analytics are populated immediately. `npm run build`
produces a static site in `dist/`.

> **Live OCR note.** The Excel-upload path, enrichment, benchmark, analytics and
> export all run **fully in the browser** — no server needed. The **"OCR
> invoices"** button calls Claude and must go through the included serverless
> proxy (`api/ocr.js`) so the API key stays server-side. Locally it will only
> work if you run on a platform that serves that function (e.g. `vercel dev`).

---

## Deploy

### Option A — Vercel (recommended: supports live OCR)

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com) → **New Project** → import the repo.
   The **Vite** preset is auto-detected (`vercel.json` is included).
3. To enable the OCR button, add an environment variable
   **`ANTHROPIC_API_KEY`** in **Settings → Environment Variables**. The proxy in
   `api/ocr.js` reads it; the key is never shipped to the browser.
4. Deploy. Every `git push` redeploys automatically.

The site is served at the domain root, so `base` stays `/` (default). Netlify
works the same way — move `api/ocr.js` to `netlify/functions/ocr.js`.

### Option B — GitHub Pages (static; Excel-upload only)

Pages can't run the serverless function, so the OCR button won't work there — the
Excel-upload path still does. Two ways:

**Automatic (CI):** the included workflow `.github/workflows/deploy-pages.yml`
builds on every push to `main` and sets the base path to your repo name. In the
repo → **Settings → Pages**, set **Source: GitHub Actions**. Done.

**Manual:**

```bash
npm run deploy     # builds with VITE_BASE=/partsindex/ and pushes to gh-pages
```

Then **Settings → Pages → Source: `gh-pages` branch**. If your repo isn't named
`partsindex`, edit the `deploy` script's `VITE_BASE=/<your-repo>/`.

---

## Using the app

| Tab | What it does |
|---|---|
| **Dashboard** | KPI tiles (click any tile to drill into it), make-coverage bars, top fuzzy-matched benchmarks — **click a part to expand its quotes** |
| **Demo** | Stakeholder-facing benchmark lookup: filter by make/model, part name or number (normalisation-aware), or global search → **median & mean** per part; click a row for every source quote (supplier · bill · date · grade · price · OCR/Excel). Add parts to a **Worklist** with `+` and export it to **Excel** or **PDF** |
| **Ingest** | Excel upload, live OCR, reload-demo, export, clear, activity log |
| **Parts Ledger** | Every enriched line with Make/Model columns; search + filter by make / line-type |
| **Benchmark** | Hybrid matching configuration (part-number-first, optional name bridging) + the median table with Make, Model, Basis and **IQR band** columns and a **Min quotes for reliable spread** floor slider; click a row to see the grouped quotes |
| **Assess a Claim** | Paste a repairer estimate → line-by-line variance vs the benchmark, total potential over-claim, % flags, and an **ABOVE BOUND** flag for lines past the Tukey outlier fence |
| **Analytics** | All 8 methods, selectable — the median-benchmark view is also click-to-expand |
| **Coverage** | Make & category coverage vs the success criteria |
| **Method Notes** | What each analytic computes and why |

The **18-bill demo loads automatically** on first visit. Uploaded data persists
and is shown on return; an explicit **Clear dataset** stays cleared across
reloads (it won't re-seed the demo).

### Ingesting the real invoices

- **Bulk (recommended for the 200-invoice run):** the batch runner —
  `npm run ocr:batch -- --in ./invoices` — OCRs a whole folder through the
  Claude API with the app's exact prompt, **validates every response against
  the schema**, runs the totals-reconciliation gate, dedupes on
  supplier + bill number, and emits `PartsIndex_import.xlsx` for the app's
  *Bulk upload* button. Resumable (SHA-256 manifest), retrying, and it
  supports the **Message Batches API** (`--mode batch`) for 50% token cost.
  See [Batch OCR runner](#batch-ocr-runner) below.
- **Spreadsheets:** Ingest → *Bulk upload*. Columns are matched flexibly
  (Part Name, Part No, Qty, Unit, Total, Supplier, Make, Model, Bill No, Date,
  and — from the batch runner — Grade, Unit Basis, GST, Review, Review Reason).
- **Raw invoices, one at a time:** Ingest → *OCR invoices* (needs the Vercel proxy + key). A **model picker** on the card chooses which Claude model reads the documents (Sonnet by default; Haiku for clean prints, Opus/Fable for faint fax and handwriting) — the batch runner takes the same choice via `--model`.
- The OCR prompt both paths use lives in [`src/ocrPrompt.js`](./src/ocrPrompt.js)
  (documented in [`OCR_PROMPT.md`](./OCR_PROMPT.md)) — one source of truth.

---

## Batch OCR runner

`tools/batch-ocr.mjs` is the pipeline for turning a folder of supplier bills
into an app-ready workbook, built to survive a 200-invoice run:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run ocr:batch -- --in ./invoices --dry-run     # show the plan, no API calls
npm run ocr:batch -- --in ./invoices --limit 5     # trial run on 5 files first
npm run ocr:batch -- --in ./invoices               # live, 2 concurrent calls
npm run ocr:batch -- --in ./invoices --mode batch  # Message Batches API — 50% cost, ≤24 h
```

What it guarantees:

- **Schema validation before ingest** — every response is checked against the
  invoice schema (`validateInvoice` in `src/pipeline.js`); model output drift
  becomes a logged failure, not a corrupted benchmark.
- **Reconciliation gate** — extracted line totals vs the invoice's own printed
  subtotal; mismatches are exported with `Review = yes` and the app holds them
  in the Ingest review queue, out of all benchmarks.
- **Duplicate protection** — same supplier + bill number is never extracted
  twice, across runs.
- **Resume** — `ocr_out/manifest.json` records every file by SHA-256; re-running
  skips completed work, `--retry-failed` re-attempts failures, and pending
  Message Batches are polled to completion after a crash.
- **Audit trail** — one validated JSON per invoice under `ocr_out/json/`, a
  *Run Log* sheet with per-file status/reconciliation/tokens, and
  `run_report.json`. Pass `--price-in/--price-out` ($/MTok — see the
  [pricing docs](https://docs.claude.com/en/docs/about-claude/pricing); use
  batch rates with `--mode batch`) for a cost estimate.

`tools/mock-server.mjs` fakes the API locally so the whole flow can be tested
offline (`node tools/mock-server.mjs`, then run with
`PARTSINDEX_API_BASE=http://127.0.0.1:8787`). `npm run test:tools` runs the
self-test suite over the validation, dedup, manifest, dispute-pack, and
dispersion-statistics (IQR / SD / CV, Tukey fences, reliability floor) logic.

---

## Data model & persistence

Each stored line:

```json
{
  "supplier": "Min Ghee Auto Pte Ltd", "bill_no": "8122844", "bill_date": "04/10/2018",
  "make": "Mercedes-Benz", "model": "E-Class (W213)",
  "part_name": "HEADLAMP UNIT", "part_number": "MBA213 906 67 01", "npn": "MBA2139066701",
  "cat": "Headlamp", "qty": 1, "unit": 2050.0, "total": 2050.0,
  "ltype": "Supplier Part", "doc_type": "Tax Invoice"
}
```

**This app** persists to the browser's `localStorage`. **For a productised,
multi-user service, use SQLite** — a single-file DB is genuinely self-sustaining
at this scale (no server to administer, trivial backups) and supports every query
here (GROUP BY, window-function medians, trend-by-date). Suggested schema:

```sql
CREATE TABLE suppliers  (id INTEGER PRIMARY KEY, name TEXT, coy_id TEXT, gst TEXT);
CREATE TABLE invoices   (id INTEGER PRIMARY KEY, bill_no TEXT, bill_date TEXT,
                         supplier_id INT, repairer TEXT, vehicle TEXT, chassis TEXT,
                         make TEXT, model TEXT, doc_type TEXT);
CREATE TABLE part_lines (id INTEGER PRIMARY KEY, invoice_id INT, part_name TEXT,
                         part_number TEXT, npn TEXT, category TEXT, qty REAL,
                         unit REAL, total REAL, line_type TEXT);
```

Move to **Postgres** only when many insurers write concurrently or you need
role-based multi-tenant access. Rule of thumb: **localStorage now → SQLite for
the productised site → Postgres for multi-tenant concurrency.**

---

## Project structure

```
partsindex/
├─ README.md                      ← this file
├─ MANUAL.md                      ← full manual + project journey
├─ OCR_PROMPT.md                  ← tuned prompt for OCR-ing the 200 invoices
├─ index.html
├─ vite.config.js                 ← base path via VITE_BASE
├─ vercel.json
├─ package.json
├─ api/
│  └─ ocr.js                      ← serverless OCR proxy (keeps API key server-side)
├─ .github/workflows/
│  └─ deploy-pages.yml            ← CI deploy to GitHub Pages
├─ public/
│  ├─ favicon.ico / favicon-32.png / favicon-128.png   ← Merimen "f" browser icon
│  ├─ apple-touch-icon.png
│  └─ screenshot.png             ← dashboard preview used in this README
├─ eval/
│  ├─ README.md                   ← gold-set labeling policy + how to read results
│  ├─ generate_pairs.mjs          ← emits candidate pairs for human labeling
│  ├─ evaluate.mjs                ← precision/recall/F1 sweep over the labeled set
│  └─ gold_pairs.example_labeled.csv  ← worked example (illustrative labels)
├─ tools/
│  ├─ batch-ocr.mjs               ← bulk OCR runner for the 200-invoice run (resumable, validating)
│  ├─ mock-server.mjs             ← local fake of the API for offline testing
│  └─ selftest.mjs                ← npm run test:tools — validation/dedup/manifest/dispute-pack tests
└─ src/
   ├─ main.jsx
   ├─ index.css
   ├─ ocrPrompt.js                ← the tuned OCR prompt — single source of truth (app + runner)
   ├─ pipeline.js                 ← pure enrichment + matcher + validation + dispute pack (shared by app, eval, tools)
   ├─ demoData.js                 ← embedded 174-line demo dataset
   └─ PartsIndex.jsx              ← the React UI
```

---

## Limitations

- **Sample size.** Benchmarks firm up only as the same part recurs across bills; the demo's 18 bills are illustrative, the incoming **200** are what make it real.
- **Accuracy (POC#2).** Quantifying TP inflation in dollars needs **matched triples** per claim (supplier-bill cost + repairer estimate + insurer final offer). The app ships the framework; feed it matched claim data to get hard numbers.
- **Live OCR** requires the serverless proxy; never embed an API key in the static bundle. Large multi-page bills may need chunking due to output token limits.

See **[`MANUAL.md`](./MANUAL.md)** for the full manual and the step-by-step
project history.
