# PartsIndex — Manual

Full manual for the Parts Pricing Reference tool: how it works, how to use every
feature, the analytics it computes, and the project history. For install &
deployment see [`README.md`](./README.md); for OCR-ing invoices see
[`OCR_PROMPT.md`](./OCR_PROMPT.md).

## Contents

1. [Why this exists](#1-why-this-exists)
2. [The pipeline](#2-the-pipeline)
3. [Configurable fuzzy matching](#3-configurable-fuzzy-matching)
4. [The eight analytics](#4-the-eight-analytics)
5. [Tabs & how to use them](#5-tabs--how-to-use-them)
6. [OCR-ing the 200 invoices](#6-ocr-ing-the-200-invoices)
7. [Persistence & SQLite](#7-persistence--sqlite)
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

Every ingested line passes through the same steps (`src/PartsIndex.jsx`):

1. **Part-number normalisation** — uppercase; drop parenthetical notes; keep the primary code before `/`; strip trailing `999x` brand filler; remove spaces/dashes/dots.
   `MBA213 885 03 38 9999` → `MBA2138850338`; `T81110-25221` → `T8111025221`.
2. **Make inference** — from the bill's vehicle/chassis first, then a part-number-prefix map (`MBA`→Mercedes, `T#####`→Toyota, `8R/8K`→Audi, `HY`→Hyundai, `V5C5`→VW, `513`→BMW, `M9#`→Chevrolet, `MK/MC…`→Mitsubishi Fuso). Make is usually **not** printed on the bill.
3. **Canonical category** — a name→category synonym map (Headlamp, Front Bumper, Fender, Radiator, Grille, Mirror, Door, …).
4. **Line-type classification** — `Supplier Part` (usable) / `Consumable / Fastener` / `Repair Estimate` (excluded from the cost benchmark) / `Labour`.
5. **Unit-cost derivation** — if unit price is blank, `unit = total / qty`.

Only **usable supplier parts** feed the benchmark; estimate and labour lines are
kept but excluded from cost aggregation.

---

## 3. Configurable fuzzy matching

The benchmark groups parts into clusters, then reports median / average / range /
quote count / suppliers per cluster. Grouping is **configurable on the Benchmark
tab**:

- **Mode**
  - **Fuzzy part name** *(default)* — clusters parts whose names are similar enough. This is what actually produces multi-quote benchmarks on real data.
  - **Category + make** — coarser grouping by canonical category.
  - **Exact part no** — strict; reproduces the old behaviour (few or no multi-quote clusters on small sets).
- **Similarity threshold** *(0.40–0.95)* — higher = stricter, tighter clusters.
- **Token vs spelling weight** *(0–1)* — the similarity score blends token overlap (Jaccard on words) with edit-distance similarity (normalised Levenshtein). Lean on **tokens** for word-order variants (`HEAD LAMP` vs `HEADLAMP ASSY`); lean on **spelling** for typos/abbreviations.
- **Only match within same make** — prevents a Toyota headlamp clustering with a Mercedes one.

**Why fuzzy, not exact PN?** On the 18-bill demo, exact part numbers yield **0**
multi-quote benchmarks (every PN is unique); fuzzy name matching yields **9–17**
real clusters depending on threshold — genuinely usable medians. A good starting
point is threshold ≈ 0.65, token weight ≈ 0.6, same-make on.

Click any benchmark row to expand the **grouped variants** — the individual
part names, numbers, suppliers, prices and dates that were merged.

---

## 4. The eight analytics

All live under the **Analytics** tab, selectable via the numbered buttons.

| # | Method | What it computes |
|---|---|---|
| 01 | **Median benchmark** | Median unit price per fuzzy cluster (average shown for skew). The core reference. |
| 02 | **Inflation flagging** | Each quoted line vs its cluster median; a **configurable %** threshold flags outliers for negotiation. |
| 03 | **Confidence scoring** | 0–100 per benchmark from quote depth (40%), supplier diversity (35%) and recency (25%), banded High/Medium/Low. |
| 04 | **Supplier dispersion** | Price spread of the same part across suppliers — flags grade differences or a mispriced supplier. |
| 05 | **Price trend** | Unit price by bill date per category (scatter strips) — separates genuine drift from one-off spikes. |
| 06 | **Cross-source agreement** | Same part from 2+ independent suppliers within 10% — the credibility signal for insurers/courts. |
| 07 | **Accuracy validation** | List-vs-net margins inside repairer estimates + cross-source identical-PN matches. Full inflation needs matched triples per claim. |
| 08 | **Normalisation view** | The clusters that unified differently-written names/part numbers — the foundation everything else stands on. |

On a small demo set several methods are sparse by design (e.g. few inflation
flags when matched quotes are identical prices). They populate as invoice volume
grows.

---

## 5. Tabs & how to use them

- **Dashboard** — KPI tiles, make-coverage bars, top fuzzy-matched benchmarks. Empty on first run; click **Load demo (18 bills)** or go to Ingest.
- **Ingest** — *Bulk upload* Claude-OCR'd spreadsheets (flexible column matching); *OCR invoices* (raw PDFs/images via the serverless proxy); demo loader; **Export .xlsx**; clear; activity log.
- **Parts Ledger** — every enriched line; search + filter by make / line-type.
- **Benchmark** — the matching configuration (§3) + the clustered median table.
- **Analytics** — the 8 methods (§4).
- **Coverage** — make & category coverage vs the success criteria.
- **Method Notes** — short reference for each analytic + the matching rationale.

---

## 6. OCR-ing the 200 invoices

See **[`OCR_PROMPT.md`](./OCR_PROMPT.md)**. In short: use the structured-JSON
prompt, one document per call, extract every part line, stitch page-splits,
exclude struck-through/returned/labour/GST rows, keep part numbers **verbatim**
(the app normalises them), and leave make/model or unit cost **blank rather than
guessed**. Output columns map onto: `Supplier, Bill No, Bill Date, Make, Model,
Doc Type, Part Name, Part Number, Qty, Unit Cost, Total Cost`. Upload via *Bulk
upload*, or use the app's *OCR invoices* button which does the JSON step for you.

---

## 7. Persistence & SQLite

This app persists to the browser's `localStorage` — zero setup, survives across
sessions. **For a productised, multi-user service, SQLite is recommended**: a
single-file DB is genuinely self-sustaining at this scale (no server to
administer, trivial backups) and supports every query here. Schema and the
`localStorage → SQLite → Postgres` progression are in the [README](./README.md#data-model--persistence).

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

---

## 9. Limitations & next steps

- **Sample size.** Benchmarks firm up only as the same part recurs across bills; the 18-bill demo is illustrative, the incoming **200** invoices are what make it real.
- **Accuracy (POC#2).** Quantifying TP inflation in dollars needs **matched triples** per claim (supplier-bill cost + repairer estimate + insurer final offer). The app ships the framework; feed it matched claim data for hard numbers.
- **Make/model** is often absent from the bill; inferred from chassis/part-prefix. Joining full claim metadata via chassis tightens this.
- **Live OCR** must run through the serverless proxy; never embed an API key in the static bundle. Large multi-page bills may need chunking (token limits).
- **Fuzzy matching** is a heuristic. Very generic names ("BRACKET", "COVER") can over-merge at low thresholds — keep same-make on and start around 0.65, then tune per the data.
