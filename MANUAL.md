# PartsIndex — Manual

Full manual for the Parts Pricing Reference tool: how it works, how to use every
feature, the analytics it computes, and the project history. For install &
deployment see [`README.md`](./README.md); for OCR-ing invoices see
[`OCR_PROMPT.md`](./OCR_PROMPT.md). New developers should start with
[`HANDOVER.md`](./HANDOVER.md); planned features are elaborated in
[`Fable.md`](./Fable.md) with implementation prompts in
[`OPUS_PROMPTS.md`](./OPUS_PROMPTS.md).

## Contents

1. [Why this exists](#1-why-this-exists)
2. [The pipeline](#2-the-pipeline)
3. [Matching (hybrid, part-number-first)](#3-matching-hybrid-part-number-first)
4. [The eight analytics](#4-the-eight-analytics)
5. [Tabs & how to use them](#5-tabs--how-to-use-them)
6. [OCR-ing the 200 invoices](#6-ocr-ing-the-200-invoices)
7. [Persistence & the shared database](#7-persistence--the-shared-database)
8. [Project journey — what was done](#8-project-journey--what-was-done)
9. [Limitations & next steps](#9-limitations--next-steps)

---

## 1. Why this exists

In SG motor **third-party** claims, the claimant can take their car to any
workshop — often not on the insurer's panel. Some inflate parts prices to pad the
claim. Insurers lack an independent, credible **reference price** to push back.

Existing Merimen sources fall short because the unique key — the **part number**
— is usually missing from PeerIndex (past approved claims) and eSource (supplier
RFQ bids). But **supplier bills** that repairers upload for OD-claim approval *do*
carry part numbers. This tool validates that GenAI OCR can read those bills
(scanned, faxed, handwritten included) and compile them into a usable pricing
reference.

**Success criteria** (from the brief): **(a) coverage** — how many top makes /
parts are represented; **(b) accuracy** — how close the reference sits to the
repairer quote / insurer final offer.

---

## 2. The pipeline

Every ingested line passes through the same steps (`src/pipeline.js` — a pure,
browser-free module shared by the app, the batch runner and the eval harness):

1. **Part-number normalisation** — uppercase; drop parenthetical notes; keep the primary code before `/`; strip trailing `999x` brand filler; remove spaces/dashes/dots.
   `MBA213 885 03 38 9999` → `MBA2138850338`; `T81110-25221` → `T8111025221`.
2. **Make inference** — from the bill's vehicle/chassis first, then a part-number-prefix map (`MBA`→Mercedes-Benz, `T#####`→Toyota, `8R/8K`→Audi, `HY`→Hyundai, `V5C5`→VW, `513`→BMW, `M9#`→Chevrolet, `MK/MC…`→Mitsubishi Fuso). Make is usually **not** printed on the bill. Whatever the source, the make is then **canonicalised** (`canonMake`): case/punctuation-insensitive with aliases (`Mercedes` / `MERCEDES BENZ` / `Merc` / `Benz` → **Mercedes-Benz**, `VW`→Volkswagen, `Chevy`→Chevrolet, …), so the Dashboard and Coverage — which match on the exact make string — never split one make into several. `Mitsubishi` and `Mitsubishi Fuso` stay distinct; an unlisted make is left untouched. It runs at ingest **and** on load (`upgradePart`), so a dataset already saved with a non-canonical make is corrected automatically.
3. **Canonical category** — a name→category synonym map (Headlamp, Front Bumper, Fender, Radiator, Grille, Mirror, Door, …).
4. **Line-type classification** — `Supplier Part` (usable) / `Consumable / Fastener` / `Repair Estimate` (excluded from the cost benchmark) / `Labour`.
5. **Unit-cost derivation** — if unit price is blank, `unit = total / qty`.

Only **usable supplier parts** feed the benchmark; estimate and labour lines are
kept but excluded from cost aggregation.

---

## 3. Matching (hybrid, part-number-first)

The benchmark groups parts into clusters, then reports median / average / range /
quote count / suppliers per cluster. Grouping is **configurable on the Benchmark
tab**:

- **Mode**
  - **Fuzzy part name** *(default)* — cluster parts whose names are similar (token overlap + edit distance). Forms usable multi-quote medians on a small dataset; can over-merge, so scope with same-make/same-model.
  - **Hybrid** — group by exact normalised **part number** first (definitely the same part), then optionally *bridge* different part numbers by fuzzy name. The most defensible basis as real volume accumulates; keeps the part number — the key supplier bills carry that PeerIndex/eSource lack — primary.
  - **Exact part no only** — strict PN grouping, no bridging.
  - **Category + make** — coarse grouping by canonical category.
- **Bridge by name across part numbers** *(off by default)* — in hybrid mode, also merge PN-groups whose names are fuzzy-similar within the same make/model. Off = most defensible (identical PN only); on = more coverage on small datasets. Bridged benchmarks are flagged **≈** in the **Basis** column; single-PN benchmarks show **PN**.
- **Similarity threshold** *(0.40–0.95)* and **token vs spelling weight** *(0–1)* — control the fuzzy score used for bridging (token overlap for word-order variants like `HEAD LAMP` vs `HEADLAMP ASSY`; spelling for typos).
- **Same make / Same model** — keep parts apart across makes and, crucially, across models — so a Camry headlamp never merges with a Hilux one even under bridging.

**Why hybrid rather than name-only?** Name-only matching over-merges — two
genuinely different Mercedes distance sensors (LH/RH) share the name "DISTANCE
SENSOR", and cross-model it could merge a Camry and Hilux headlamp at very
different prices. Part-number-first keeps the defensible identity primary; the
**Basis** flag makes clear when a benchmark relied on a looser name bridge. On the
18-bill demo, strict PN yields few multi-quote medians (every PN is nearly
unique); turning bridging on surfaces ~9 clusters. As real volume accumulates,
identical part numbers recur and bridging matters less.

Click any benchmark part — on the **Benchmark**, **Dashboard** or **Analytics**
tabs — to expand the **individual quotes** behind it.

---

## 4. The eight analytics

All live under the **Analytics** tab, selectable via the numbered buttons.

| # | Method | What it computes |
|---|---|---|
| 01 | **Median benchmark** | Median unit price per fuzzy cluster (average shown for skew). The core reference. |
| 02 | **Inflation flagging** | Each quoted line vs its cluster median; a **configurable %** threshold flags outliers for negotiation. |
| 03 | **Confidence scoring** | 0–100 per benchmark from quote depth (40%), supplier diversity (35%) and recency (25%), banded High/Medium/Low. A separate **Price spread (CV)** column shows how much the quotes behind a confident median actually agree (tight / moderate / wide) — surfacing the case where a high score still hides quotes that disagree on price. The 0–100 score itself is unchanged. |
| 04 | **Supplier dispersion** | Price spread of the same part across suppliers — flags grade differences or a mispriced supplier. Reports the raw min–max spread alongside robust measures: the **IQR band** (Q1–Q3, middle 50% of quotes), sample **standard deviation**, and the **coefficient of variation** (SD ÷ mean, %) so spread is comparable across cheap and expensive parts (<10% tight, >25% wide). |
| 05 | **Price trend** | Unit price by bill date per category (scatter strips) — separates genuine drift from one-off spikes. |
| 06 | **Cross-source agreement** | Same part from 2+ independent suppliers within 10% — the credibility signal for insurers/courts. |
| 07 | **Accuracy validation** | List-vs-net margins inside repairer estimates + cross-source identical-PN matches. Full inflation needs matched triples per claim. |
| 08 | **Normalisation view** | The clusters that unified differently-written names/part numbers — the foundation everything else stands on. |

On a small demo set several methods are sparse by design (e.g. few inflation
flags when matched quotes are identical prices). They populate as invoice volume
grows.

---

## 5. Tabs & how to use them

- **Dashboard** — KPI tiles, make-coverage bars, top fuzzy-matched benchmarks. In the browser-only build the 18-bill demo **loads automatically on first visit**, so this is populated immediately (with the shared Turso backend the app starts empty until you upload or seed — see §7). **Click any KPI tile** to open an inline breakdown, then **click a row inside it** to drill a second level into the underlying part lines (an invoice → its parts, a category → its parts, a make → its parts, a cluster band → its clusters). **Click any listed benchmark part** to expand the individual quotes behind it.
- **Demo** — a plain-language benchmark *lookup* built for showing the reference to stakeholders. Filter by **make** and **model** (the model list narrows to the chosen make), type into **part name contains** / **part number contains** (the part-number filter is normalisation-aware, so `52119` matches `T52119-06971`), or use the **global search** box to match across name, number, make, model and category at once. A **Min quotes for reliable spread** slider (1–30, default 4) sits beside the results count and shares `cfg.minQuotes` with the Benchmark tab, so tightening or loosening the reliability floor here moves the `*` advisory markers everywhere at once. Each matching benchmark shows its **median** and **mean** unit price; **click any row** to reveal every underlying supplier quote — supplier, bill number, date, grade, price, and whether the line was read by Claude OCR or imported from Excel. Build a **Worklist** as you go: the **+** in the **leftmost column** of any result row adds that part to a shortlist shown between the search and the results (or **+ Add all shown** to add the whole filtered set), and the worklist exports to **Excel** (a Worklist sheet plus an Evidence sheet of every underlying quote) or **PDF** (a printable benchmark table followed by an evidence table of the quotes behind each part). Every worklist row is itself expandable — click it to see its source quotes inline — and both exports carry that evidence. The PDF library loads on demand, so it never weighs down the app until used.
- **Ingest** — *Bulk upload* Claude-OCR'd spreadsheets (flexible column matching); *OCR invoices* (raw PDFs/images via the serverless proxy); reload-demo; **Export .xlsx**; clear; activity log.
- **Parts Ledger** — every enriched line with **Make** and **Model** columns; search + filter by make / line-type.
- **Benchmark** — the matching configuration (§3) + the clustered median table with **Make**, **Model** and Basis columns. An **IQR band** column shows the middle-50% price range (Q1–Q3) beside each median; a **`*`** marks clusters below the reliability floor, where spread is advisory. A **Min quotes for reliable spread** slider (1–30, default 4) sets that floor: clusters with fewer quotes are labelled advisory and are excluded from the statistical outlier bound used in Assess. The same slider is mirrored on the **Demo** tab (both write the shared `cfg.minQuotes`). The floor is part of the reproducibility snapshot (it changes which claim lines are flagged), so it is hashed into the snapshot id and recorded in the dispute pack. Click a row to reveal its quotes.
- **Assess a Claim** — paste an incoming repairer estimate (part no · description · quoted price per line); each line is matched to the benchmark (part number first, then name) and compared to its median, producing a per-line variance and a total **potential over-claim**, with lines above the % threshold flagged. A **Stat. bound** column additionally flags any line above the **Tukey upper fence** (Q3 + 1.5 × IQR) of its benchmark with an **ABOVE BOUND** badge, and a KPI tile counts them — a statistically defensible outlier call (above the observed price range, not merely above the median) that only fires on clusters at or above the reliability floor. The exported dispute pack records the IQR band, the statistical upper bound and the above-bound flag per line. The inverse of building the reference — putting it to work on a live claim.
- **Analytics** — the 8 methods (§4); the median-benchmark view is also click-to-expand.
- **Coverage** — make & category coverage vs the success criteria.
- **Method Notes** — short reference for each analytic + the matching rationale.

> **Persistence behaviour.** In the browser-only build, first visit seeds the
> demo, uploaded data persists and is shown on return, and an explicit **Clear
> dataset** stays cleared across reloads (it will not re-seed the demo). With the
> shared Turso backend the app **starts empty** — the demo is never auto-seeded
> into the shared database; uploads are written to libSQL via `/api/parts`
> (see §7).

---

## 6. OCR-ing the 200 invoices

See **[`OCR_PROMPT.md`](./OCR_PROMPT.md)**. In short: use the structured-JSON
prompt, one document per call, extract every part line, stitch page-splits,
exclude struck-through/returned/labour/GST rows, keep part numbers **verbatim**
(the app normalises them), and leave make/model or unit cost **blank rather than
guessed**. Since v1.8.1 the prompt requests a **token-lean output** — minified
JSON with default-valued fields omitted (unmarked grade, per-each basis,
unprinted unit cost) — which both ingest paths coerce back to the same defaults;
it cuts roughly 35–45% of output tokens and per-call latency with no change to
what lands in the dataset. Output columns map onto: `Supplier, Bill No, Bill
Date, Make, Model, Doc Type, Part Name, Part Number, Qty, Unit Cost, Total
Cost`. Upload via *Bulk upload*, or use the app's *OCR invoices* button which
does the JSON step for you.

---

## 7. Persistence & the shared database

By default the app persists the dataset to the browser's `localStorage` — zero
setup, per-browser, fine for the POC and for the static GitHub Pages build. The
whole dataset is the single object `{ parts: [ …enriched lines ] }`.

When the benchmark needs to be **one shared reference** that every user queries
(not a private copy per browser), the app ships an optional server-backed store
built on **Turso / libSQL — SQLite over HTTP**. It is off unless configured, and
turning it on changes no component code.

**Why not a plain SQLite file.** On Vercel, serverless functions have an
ephemeral, effectively read-only filesystem — only `/tmp` is writable, it is
discarded between invocations, and concurrent instances don't share it — so a
file-based `.db` cannot persist writes. libSQL is Turso's SQLite fork spoken
**over HTTP**: same SQL, same schema, but stateless per-request calls to a
remote database, which suits ephemeral serverless (no always-on pool). The only
local↔prod difference is the URL: `file:local.db` locally, `libsql://<db>.turso.io`
(with `TURSO_AUTH_TOKEN`) in production.

**Shape of it.** Three small pieces, mirroring how `api/ocr.js` keeps the Claude
key server-side:

- `api/_db.js` — the libSQL client, the `parts` table schema (one row per
  enriched line, the exact 21-field object the app already holds), and
  `getDataset` / `upsertParts` / `replaceDataset`. **Server-only**; it reads
  `TURSO_AUTH_TOKEN`, which never reaches the browser.
- `api/parts.js` — the endpoint. `GET /api/parts` → `{ parts: [...] }`;
  `POST /api/parts` with `{ mode:"replace"|"append", parts:[...] }` writes.
- `src/datasource.js` — `loadDataset()` / `saveDataset()` used by the app. A
  build-time flag `VITE_DATA_BACKEND` picks `local` (localStorage, default) or
  `api` (the shared DB). In `api` mode the browser only ever fetches the
  same-origin endpoint.

`src/pipeline.js` is untouched: it works on plain arrays, indifferent to whether
they came from `localStorage` or a `SELECT`. The statistics stay in JS on
purpose — pushing median/IQR into SQL would break the Excel-reconcilable
`PERCENTILE.INC` guarantee (§4).

**The activity log persists the same way.** Every ingest, OCR, review and dataset
action on the Ingest tab is recorded as a **structured event** — an ISO
timestamp (date **and** time), a `kind` (ingest / ocr / review / dataset /
error), a status, the affected line count, the originating file/bill, and a JSON
`detail` blob — and written through the *same* backend switch: `loadEvents()` /
`appendEvent()` in `src/datasource.js` go to a `localStorage` key
(`partsindex_activity_v1`, a rolling 500 events) by default, or to a new
`activity` table via `GET`/`POST /api/activity` (served by `api/activity.js`,
backed by `getActivity` / `appendActivity` in `api/_db.js`) when
`VITE_DATA_BACKEND=api`. So the Ingest history now **survives a reload**, and on
the shared backend it is one audit trail every user sees. Adding the table bumped
`SCHEMA_VERSION` to 2; `npm run db:init` creates it (`CREATE TABLE IF NOT EXISTS`,
so it is safe to re-run against an existing 1.9-era database). In the app each log
row **expands** to its full detail — for an OCR event that is the Claude model
used and the totals-reconciliation outcome (extracted sum vs printed total, basis
and difference); for an import, the suppliers/makes/bills touched — and the list
can be filtered by kind.

**Sortable tables.** Independently of persistence, every data table across the
app now sorts on any column — click a header for A→Z, again for Z→A (a shared
`useSort`/`SortTh` layer with a numeric-aware comparator, so `S$`/`%` sort as
numbers). It is pure view state and touches neither the dataset nor the stats.

**Enabling it.** Create a Turso database, set `TURSO_DATABASE_URL` +
`TURSO_AUTH_TOKEN` + `VITE_DATA_BACKEND=api` (locally in `.env`, in prod via the
Vercel dashboard), then `npm run db:init` (schema) or `npm run db:seed` (schema
+ 18-bill demo). For local dev without Turso at all, point it at a file:
`TURSO_DATABASE_URL=file:local.db npm run db:seed`. Full walkthrough and the DDL
are in the [README](./README.md#data-model--persistence).

**Seeding is deliberate on the shared backend.** In the browser-only build the
demo auto-seeds on first run for a populated stakeholder demo. With the shared
backend the app **starts empty** and never auto-writes the demo — otherwise every
fresh browser hitting an empty shared database would push 174 demo rows into the
reference everyone queries. Seed it on purpose (`npm run db:seed` server-side, or
the **Load demo** button in-app), and real uploads/OCR are written to libSQL via
`/api/parts`.

Move to **Postgres** (Vercel Marketplace: Neon / Supabase / Prisma Postgres)
only when many insurers write concurrently or you need role-based multi-tenant
access. Progression: **localStorage (one user) → Turso/libSQL (shared reference)
→ Postgres (multi-tenant concurrency)**.

---

## 8. Project journey — what was done

**Step 1 — Understood the problem.** Read the project spreadsheet: the
TP-inflation problem, why PeerIndex/eSource fail (missing part numbers), and the
POC plan (Bill Extraction #1 and #2).

**Step 2 — POC#1 extraction.** GenAI vision OCR on the **18 sample supplier-bill
PDFs** (33 invoices/estimates) → **174 part lines** per the Bill Extraction #1
spec. Delivered a four-sheet workbook. Key result: part numbers were present and
extractable on essentially every bill, and GenAI handled the format variability
(faxed, handwritten, multi-page) that defeated the previous OCR generation.

**Step 3 — Enrichment pipeline.** Added part-number normalisation, line-type
classification, make/model enrichment, a benchmark, and coverage + inflation
scaffolding. Honest finding: on 18 bills nearly every exact part number appears
once — volume (Extraction #2) is what makes benchmarks meaningful.

**Step 4 — Web app.** A single-file React app that ingests Claude-OCR'd Excel or
OCRs raw invoices live, runs the pipeline, and presents dashboard / benchmark /
coverage / methods, with persistence and Excel export.

**Step 5 — Merimen brand + demo data.** Re-skinned to the Merimen/Fermion palette
(petrol-teal `#006E96` + lime `#C3D700`, ice-cyan panels) from the Motor Claims
deck, and embedded the initial 18 bills as the demo dataset.

**Step 6 — Fuzzy matching + full analytics.** Replaced exact-PN grouping with
**configurable fuzzy name matching** (the change that makes benchmarks form on
real data), and made **all 8 analysis methods live and selectable** under the
Analytics tab.

**Step 7 — Deployable scaffold.** Packaged as a ready-to-push Vite project with a
serverless OCR proxy (`api/ocr.js`), GitHub Pages CI workflow, `localStorage`
persistence, and this documentation.

**Step 8 — Auto-load, quote & KPI drill-down.** The demo dataset now loads
automatically on first visit (respecting saved uploads and an explicit clear).
Clicking any benchmark part on the Dashboard, Benchmark and Analytics tabs expands
the individual quotes behind it, and every dashboard KPI tile is clickable to
reveal an inline breakdown (invoice list, line-type split, categories, cluster
sizes, per-make coverage, benchmark-ready parts). Fixed the earlier
unicode-escape rendering issue, added the Merimen favicon/header logo, and added a
dashboard preview screenshot.

**Step 9 — Hybrid matching + Assess a Claim.** Reworked the benchmark to group by
exact part number first, with optional name **bridging** (off by default) and
same-model separation, plus a **Basis** (PN / ≈) flag so a reader can see whether
a benchmark rests on an identical part number or a looser name match. Added the
**Assess a Claim** tab: paste a repairer estimate and get a line-by-line variance
against the benchmark with a total potential over-claim — the inverse workflow
that turns the reference into a daily adjuster tool.

**Step 10 — Batch OCR runner + dispute pack.** Built the two pieces that carry
the POC into daily use. (a) `tools/batch-ocr.mjs`: a resumable bulk runner for
the 200-invoice extraction — same prompt as the app (now shared via
`src/ocrPrompt.js`), **schema validation on every response**, the reconciliation
gate, cross-run duplicate protection, a SHA-256 manifest so crashed runs resume,
optional **Message Batches API** mode at 50% token cost, and an app-importable
`PartsIndex_import.xlsx` with a per-file Run Log. (b) **Export dispute pack** on
the Assess tab: an Excel with Summary / Line Assessment / **Evidence** sheets —
every underlying supplier quote behind every benchmark used — stamped with a
**benchmark snapshot id** (hash of the usable dataset + matching config) so any
figure quoted in a negotiation is reproducible later. Along the way, fixed a
latent Assess-tab bug (`normPN`/`similarity` were used but not imported) and
taught the Excel importer to read Grade / Unit Basis / GST / Review columns so
the runner's output round-trips losslessly.

**Step 11 — Tag legend, OCR model picker, stale-data migration.** A field
screenshot showed the quote-drill-down tags rendering as an empty pill and a
bare "per": the browser's persisted dataset predated the grade/unit-basis
fields, so `undefined` slipped past the `!== "Unknown"` badge checks. Fixed at
the root with `upgradePart` — stored datasets are migrated on load, back-filling
grade / unit basis / GST / review via the same inference the app applies at
ingest (present values always win) — plus defensive badge rendering. The tags
now carry hover tooltips and the Analytics → Median benchmark header explains
them (grade tag: shown only when known, different grades never merge; per
pair/set tag: kept out of per-each medians). Also added a **Claude model
picker** to the Ingest OCR card (Sonnet default; Haiku for clean prints;
Opus/Fable for the worst scans), persisted per browser and passed straight
through the proxy — the batch runner takes the same choice via `--model`.

**Step 12 — Drill-downs across all Analytics views.** Previously only Median
benchmark expanded into its quotes; the other seven views were static tables.
Now every row everywhere opens the evidence behind the number: inflation flags
open the offending bill and the full cluster it was judged against; confidence
scores break down into depth / diversity / recency bars with the exact points
each contributes; dispersion rows show the cheapest-vs-dearest gap with an
automatic caution when the quotes span different grades; trend strips list
their lines chronologically with dearest/cheapest highlighted; agreement rows
show the spread-vs-tolerance arithmetic; accuracy Signal 1 expands each
estimate to line-level list-vs-net and Signal 2 shows per-bill provenance for
every cross-source match; and normalisation rows reveal each raw spelling that
was merged — the over-merge inspection view. Rationale: a reference an
adjuster can't verify is a reference they won't defend, so no number in the
app should be more than one click from its source quotes.

**Step 13 — Drill-downs on the remaining tabs.** Extended the same principle
beyond Analytics. **Parts Ledger** rows open the full record (bill · date ·
doc type · GST · grade · unit basis · normalised PN · qty × unit = total ·
ingest source · review reason), the bill context (sibling line count and bill
total), and the benchmark the line feeds — with the other quotes in that
cluster, or the reason it feeds none (estimate/consumable/labour by design,
held for review, or sole quote). **Assess a Claim** result rows open the match
evidence: how the line matched (exact PN vs name similarity vs threshold),
the cluster's median/range/suppliers, and its quotes — the on-screen twin of
the dispute pack's Evidence sheet; unmatched lines now explain themselves via
`matchLine`'s new nearest-rejected-candidate return ("closest was X at 0.58,
below the 0.65 threshold"), turning a dead "no match" into an actionable one.
**Coverage** makes and categories, and the Dashboard's make-coverage bars,
expand into their underlying part lines. Ingest needed nothing: its review
queue already lists every held line inline.

**Step 14 — Dispersion measures (IQR / SD / CV) + configurable reliability
floor.** Added three pure functions to `src/pipeline.js` — `quantile` (R-7 /
Excel `PERCENTILE.INC`), `stdev` (sample, n−1, matching `STDEV.S`) and
`dispersion` — and folded them into `makeCluster`, so every cluster now carries
`q1/q3/iqr/sd/cv` plus Tukey `lowerFence/upperFence` and a `reliable` flag. The
Excel-consistent formulas are deliberate: every figure the app shows reconciles
against a stakeholder's spreadsheet of the same quotes. These surface as an
**IQR band** column on the Benchmark tab, full IQR/SD/CV columns on the
Analytics dispersion view, a companion **Price spread (CV)** column on
confidence scoring (score unchanged), and — the piece with teeth — an
**ABOVE BOUND** flag in Assess for any estimate line above a cluster's Tukey
upper fence, a defensible outlier call rather than a bare percentage. The
reliability floor (minimum quotes before spread is trusted and a fence is
applied) is a **Min quotes for reliable spread** slider (1–30, default 4) —
surfaced on both the **Benchmark** and **Demo** tabs — that threads through the
shared `cfg.minQuotes` and, because it changes which lines are flagged,
is folded into the reproducibility snapshot and the dispute pack. A single
quote correctly returns `sd`/`cv` as `NaN` and `reliable:false`, so it can never
masquerade as zero-variance / perfect agreement. Fourteen new self-test
assertions cover the quartile values against Excel references, the small-sample
guards, the fences and end-to-end propagation through the floor.

**Step 15 — Demo lookup tab.** Added a stakeholder-facing **Demo** tab: a
plain-language benchmark search over the same clusters the rest of the app uses.
Filter by make and a make-dependent model list, by *part name contains* /
*part number contains* (the PN filter is normalisation-aware, so `52119` finds
`T52119-06971`), or with a global search across name / number / make / model /
category / grade at once. Each match shows the **median** and **mean** unit
price with the same reliability marker; clicking a row reveals every underlying
supplier quote with full provenance — supplier, bill number, date, grade, price,
and whether the line was read by **Claude OCR** or imported from **Excel** (the
shared `QuoteLines` drill-down gained an opt-in source line, leaving the other
tabs untouched). Results sort by quote depth so the most defensible benchmarks
lead.

**Step 16 — Vehicle model shown everywhere.** Surfaced the vehicle **model**
consistently across every tab, drill-down and export, not just the Demo tab.
Each cluster now tracks its distinct `models` and a `modelMixed` flag, so a
cluster that legitimately spans models (possible with *Same model* off) shows
its representative model with a `+N` marker and a hover listing all of them
rather than silently showing only the first. Model now appears as a column on
the Benchmark table, the Parts Ledger, the Dashboard "benchmark-ready" drill-in,
and the Inflation / Confidence / Dispersion / Cross-source / Normalisation
analytics tables; inline in the Dashboard top-benchmarks list, the Price-trend
dots and their date-ordered lines, the Assess match (and nearest-rejected)
evidence, and every `QuoteLines` / part-line drill-down; and as dedicated
**Make** and **Model** columns in the dispute-pack Line Assessment and Evidence
sheets plus the app's Benchmark Excel export (which also gained IQR/SD/CV/
reliability columns). A single `modelLabel` helper keeps the `+N` presentation
uniform, and the Demo model filter now matches any of a cluster's models so a
model search surfaces mixed clusters that contain it.

**Step 17 — Demo worklist with Excel + PDF export.** Added a **Worklist** to the
Demo tab, between the search and the results. A **+** on any result row (or
**+ Add all shown**) adds that benchmark to a shortlist a user can build while
looking parts up; each entry shows its make, model, quotes, median and mean,
with a one-click remove. The worklist exports two ways: **Excel** — a *Worklist*
sheet (make/model, quotes, suppliers, median/mean/min/max, IQR/SD/CV and a
reliability flag) plus an *Evidence* sheet listing every underlying supplier
quote behind the shortlisted parts — and **PDF**, a clean printable benchmark
table (landscape, with the reliability caveat footnoted). The PDF generator
(`jspdf` + `jspdf-autotable`) is **loaded on demand** via dynamic import, so it
lands in its own lazy chunk and never enters the main bundle until a user
actually clicks Export PDF. The worklist holds cluster keys and resolves them
against the live benchmark, so its figures stay current with the dataset.

**Step 18 — Worklist drill-down + evidence in exports.** Made each worklist row
expandable, matching the results table: clicking a row reveals its benchmark
summary and every underlying supplier quote (with bill, date, grade and
OCR/Excel source) inline. The exports now carry that same evidence — the Excel
already had an *Evidence* sheet listing every quote behind the shortlisted
parts, and the **PDF** gained an "Underlying supplier quotes" table beneath the
worklist summary, with a `#` column tying each quote back to its worklist row —
so a shortlist exported for a stakeholder is self-contained, showing not just
the median but the quotes that produced it.

---

## 9. Limitations & next steps

> Every limitation below that has a planned fix maps to a ready-to-run
> implementation prompt in [`OPUS_PROMPTS.md`](./OPUS_PROMPTS.md) (P1–P7).
> **New features** beyond fixing limitations — estimate OCR intake,
> chassis/VIN enrichment, recency-weighted benchmarks, supplier scorecards,
> the POC#2 claim-outcomes module, a quarterly price index, and shareable
> benchmark bundles — are elaborated in [`Fable.md`](./Fable.md) (F1–F7)
> with prompts P8–P14.

- **Sample size.** Benchmarks firm up only as the same part recurs across bills; the 18-bill demo is illustrative, the incoming **200** invoices are what make it real. With strict (PN-only) matching most demo parts are single-quote — turn on bridging to see medians form.
- **Accuracy (POC#2).** Quantifying TP inflation in dollars needs **matched triples** per claim (supplier-bill cost + repairer estimate + insurer final offer). The Assess tab compares an estimate to the benchmark; feeding it real final-offer data closes the loop.
- **Make/model** is often absent from the bill; inferred from chassis/part-prefix. Joining full claim metadata via chassis tightens this and makes same-model separation exact.
- **Price comparability.** Bills span multiple years and mixed GST treatment; medians currently treat all prices as directly comparable. Normalising to ex-GST and weighting by recency is a worthwhile next step.
- **Live OCR** must run through the serverless proxy; never embed an API key in the static bundle. For volume, use the batch runner (`npm run ocr:batch`) — it validates, reconciles, dedupes and resumes; very large multi-page bills may still need splitting (the runner rejects files over the request cap and says so).
- **Benchmark reproducibility** is handled at export time (each dispute pack carries a snapshot id), but past snapshots are not stored — regenerating an old pack requires the dataset as it stood. Persisting benchmark snapshots is the natural next step once storage moves beyond localStorage.
- **Name bridging** is a heuristic. Generic names ("BRACKET", "COVER") can over-merge — it's off by default, kept scoped to same make/model, and every bridged benchmark is flagged **≈** so it can be treated as indicative.
- **The OCR proxy is unauthenticated.** `api/ocr.js` keeps the API key server-side, but anyone who discovers the deployment URL can POST arbitrary requests and spend the key's credits — there is no origin check, shared secret, model allowlist or rate limit yet. Acceptable for a low-profile POC URL; harden it (or take the deployment down between demos) before the URL circulates.
- **`localStorage` is bounded (~5 MB).** The 174-line demo is far below it, but a 200-invoice dataset plus a review queue approaches it, and a failed write currently only logs to the console — the app keeps running on in-memory data that will not survive a refresh. Export to Excel regularly during large ingests; a quota meter and visible-failure banner are on the list.
- **Matcher calibration is pending.** `eval/gold_pairs.csv` (138 candidate pairs) is generated but not yet human-labeled, so the shipped threshold (0.65) is uncalibrated and the two known matcher issues below are unfixed.

### Known matcher issues — fix before the 200-invoice run

Both were surfaced by the eval harness and are reproducible on the demo set:

1. **Positional-stopword false merge (permanent).** `fr`, `frt`, `front` are in
   the stopword list, so `WEATHERSTRIP, HOOD` and `WEATHERSTRIP, HOOD, FR`
   normalise to the same string and merge at *every* threshold — no threshold
   tuning can recover an identity difference that normalisation erased. The list
   is also asymmetric: front tokens are stripped but `rear`/`rr` are kept.
   Per the labeling policy (eval/README.md) LH/RH *are* the same part for
   pricing, so stripping side tokens is deliberate — the axis (front/rear)
   tokens are the bug.
2. **Threshold headroom.** `DOOR PANEL FRONT` vs `DOOR PANEL REAR` scores 0.667
   and merges at the 0.65 default; on the demo set 0.70–0.75 costs no recall.
   Confirm on the labeled 200-invoice gold set before changing the shipped
   default.

### Pre-run checklist (200 invoices)

1. Fix the front/rear stopword bug and re-run `npm run eval:score`.
2. Label `eval/gold_pairs.csv` (y/n/? — policy in `eval/README.md`), sweep, and
   pin the calibrated threshold as the shipped default.
3. Trial the runner: `npm run ocr:batch -- --in ./invoices --dry-run`, then
   `--limit 5`, verify the extracted JSONs against the source PDFs, then run the
   full folder (`--mode batch` for 50% token cost).
4. Export the dataset to Excel immediately after import as a storage-quota
   safety net.


---

## Data quality & validation (added July 2026)

### Grade, GST and unit basis
Every enriched line now carries `grade` (OEM Genuine / OES / Aftermarket /
Used/Recon / Unknown), `unit_basis` (each / pair / set) and `gst` (incl / excl /
unknown). Values supplied by OCR or an Excel column win; otherwise grade and basis
are inferred from name tags (`(ORIGINAL)` → OEM Genuine, `(TW)`/`APM` → Aftermarket,
`RECON` → Used/Recon, `LH/RH`/`SET` → pair/set) and never guessed. Clustering
respects them: with **Separate grades** on (the default), quotes whose grades are
*both known and different* never merge — genuine and aftermarket prices for the
same part number are different markets, not one benchmark. Unknown grades never
block a merge. Per-pair lines never merge with per-each lines in any mode. Mixed-
grade clusters (possible only with the toggle off) are flagged **MIXED GRADE** in
red on the Benchmark tab.

### Totals-reconciliation gate & review queue
The OCR prompt now also extracts the invoice's printed **parts subtotal**, GST
amount and grand total. On upload, the sum of extracted line totals is compared to
the printed subtotal (tolerance: S$1 or 0.5%, whichever is larger). A mismatch
means lines were missed, duplicated or misread, so the whole bill is **held for
review**: its lines are stored but excluded from every benchmark, KPI and analytic,
an amber *Needs review* KPI appears on the Dashboard, and the Ingest tab shows a
review queue with the reason and the extracted lines, plus **Accept** (lines are
correct → join the benchmark) and **Discard** (drop the bill). Bills whose
supplier + bill number already exist in the dataset are skipped at upload —
duplicates would double-count quotes and skew medians.

### Gold-standard matcher evaluation
`npm run eval:pairs` generates `eval/gold_pairs.csv` — candidate part pairs from
the dataset, sorted so the borderline region is labeled first. Fill the `label`
column (y / n / ?), then `npm run eval:score` replays the exact production
similarity function (`src/pipeline.js` is imported directly) and reports
precision / recall / F1 for thresholds 0.40–0.95 at token weights 0.4/0.6/0.8,
plus the "dispute-grade" setting: the highest recall achievable at ≥95% precision.
Labeling policy, worked example and the two issues it already found (a positional-
stopword bug causing a permanent false merge, and headroom to raise the default
threshold) are documented in `eval/README.md`. Re-run the score after **any**
matcher change — it is the regression test for the heart of the product.

### Dispersion measures & the reliability floor
Each benchmark reports, beyond median and mean, the **interquartile range**
(Q1–Q3), the sample **standard deviation** and the **coefficient of variation**
(SD ÷ mean, %). The choices are deliberate. Parts pricing is right-skewed — a few
inflated quotes drag the mean and SD up — so IQR and the median are the robust
core, and the Tukey **upper fence** (Q3 + 1.5 × IQR) gives a defensible outlier
bound for claim assessment rather than an arguable percentage. Raw SD is
misleading across parts at very different price points, so spread is reported as
CV (%) for comparability (a rule of thumb: under 10% tight, over 25% wide).
Quantiles use Excel's `PERCENTILE.INC` (R-7) and SD uses `STDEV.S` (n−1) so every
figure reconciles against a spreadsheet a non-technical stakeholder can build. A
cluster with a single quote returns SD/CV as `NaN`, never 0 — one quote has no
measurable spread and must not read as perfect agreement.

Because the middle-50% band and fences are only meaningful with enough
observations, a **reliability floor** (the *Min quotes for reliable spread*
slider, range 1–30, default 4, on both the Benchmark and Demo tabs) marks thin
clusters as advisory (a `*` on the median) and withholds the statistical outlier
bound from them. The floor is configurable
because the right value depends on real volume; it is hashed into the benchmark
snapshot id and recorded in the dispute pack, so a figure quoted in a negotiation
stays reproducible even after the floor is retuned.
