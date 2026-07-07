# HANDOVER.md — PartsIndex for a new developer

*Written at v1.8.0, July 2026. Assumes you know JavaScript and some React,
but nothing about this project or the insurance domain. Read this top to
bottom once; after that, [`MANUAL.md`](./MANUAL.md) is the full reference.*

## 1. What this thing is, in three paragraphs

When someone's car is damaged by another driver in Singapore, the victim's
workshop sends the at-fault driver's **insurer** a repair estimate — a
**third-party (TP) claim**. Some workshops inflate the parts prices on those
estimates, and insurers have had no independent price reference to push back
with. Merimen (where this project lives) has claims data, but its existing
sources are missing the one field that lets you say "this is the *same part*"
across documents: the **part number**.

The insight: when workshops repair a car under the *owner's own* policy (an
OD claim), they upload **supplier bills** for approval — and those bills *do*
print part numbers, plus what the part actually cost. PartsIndex uses Claude's
vision OCR to read those bills (including faxed, scanned and handwritten
ones), extracts every part line into structured data, groups the same part
across many bills, and computes a **median benchmark price** per part.

The product then works in reverse too: paste a repairer's estimate into the
**Assess a Claim** tab and every line is compared to its benchmark, flagging
inflated prices with statistics an insurer can defend in a negotiation — and
exporting a **dispute pack** (Excel) with the full evidence trail. Everything
you build here ultimately serves one of two success criteria from the project
brief: **(a) coverage** (how many makes/parts the reference covers) and
**(b) accuracy** (how close the reference sits to real settlement outcomes).

## 2. Get it running (5 minutes)

```bash
npm install
npm run dev          # http://localhost:5173
npm run test:tools   # the self-test suite — must pass before any commit
npm run build        # must also pass before any commit
```

On first load the app seeds itself with an embedded **demo dataset** (18 real
supplier bills, 174 part lines) so every tab is populated immediately. Data
persists in your browser's `localStorage`; "Clear dataset" on the Ingest tab
wipes it (and stays cleared — it won't re-seed).

The **"OCR invoices"** button will *not* work locally with plain `vite`,
because it calls a serverless function (`api/ocr.js`) that only exists on a
platform that serves it (`vercel dev` locally, or a Vercel deployment with an
`ANTHROPIC_API_KEY` env var). Everything else — Excel upload, benchmark,
analytics, exports — runs entirely in the browser.

## 3. The tour: what lives where

```
src/pipeline.js     ← THE most important file. All pure logic: enrichment,
                       part-number normalisation, fuzzy matching, clustering,
                       statistics, validation, snapshot ids, dispute pack.
                       No browser APIs. Imported by the app, the eval
                       harness AND the batch runner — change it and you
                       change all three.
src/PartsIndex.jsx  ← The entire React UI (~1,230 lines): all tabs, state,
                       localStorage glue, Excel parsing, OCR fetch.
src/ocrPrompt.js    ← The OCR system prompt. Single source of truth — the
                       in-app OCR button and the batch runner both import it.
src/demoData.js     ← The embedded 174-line demo dataset.
api/ocr.js          ← Vercel serverless proxy: forwards OCR requests to the
                       Anthropic API so the key never reaches the browser.
tools/batch-ocr.mjs ← Bulk OCR runner for the 200-invoice run (resumable,
                       validating, dedupe-ing). Run with npm run ocr:batch.
tools/selftest.mjs  ← The test suite (npm run test:tools). Plain Node
                       assertions, no framework.
tools/mock-server.mjs ← Fake Anthropic API for offline testing of the runner.
eval/               ← Matcher evaluation harness: generate candidate part
                       pairs, human-label them, score precision/recall.
```

Docs: `README.md` (deploy + feature overview), `MANUAL.md` (everything,
including the project history and current limitations in §9),
`OCR_PROMPT.md` (the extraction prompt explained), `CHANGELOG.md`,
`OPUS_PROMPTS.md` (ready-to-run implementation prompts for planned work),
`Fable.md` (the feature roadmap those prompts implement).

## 4. The five concepts you must understand

### 4.1 The pipeline (a part line's life)
Every ingested line — whether from an OCR'd PDF or an uploaded Excel — passes
through `enrichPart()`: part number **normalised** (`normPN`: uppercase, strip
brackets/spaces/dashes and trailing `999x` filler → `T81110-25221` becomes
`T8111025221`), **make inferred** (printed value wins, else a part-number
prefix map), **category** assigned from name keywords, **line type**
classified (only `Supplier Part` lines feed the benchmark — estimates, labour
and consumables are kept but excluded), and **grade / unit-basis / GST**
attached. Enrichment happens *once at ingest* and the result is persisted —
which is why `upgradePart()` exists: it back-fills fields on datasets stored
by older app versions when they're loaded.

### 4.2 Clustering (how a benchmark forms)
`buildClusters(parts, cfg)` groups usable lines into clusters; each cluster
becomes one benchmark row (median, mean, min/max, quote count, suppliers…).
Four modes; the two that matter:

- **fuzzy-name** (shipped default): group lines whose names are similar,
  scored by `similarity()` = weighted mix of token overlap (Jaccard) and edit
  distance (Levenshtein). Forms usable medians on small data; can over-merge.
- **hybrid** (recommended as volume grows): group by exact normalised part
  number first — certain identity — then optionally *bridge* PN-groups whose
  names are similar. Bridged clusters are flagged `≈` in the UI.

**Guards that never merge, in any mode:** different known grades (an OEM
genuine part and an aftermarket copy are different markets), different unit
bases (a per-pair price must never enter a per-each median), and — when the
toggles are on — different makes/models. Learn the guard pattern
(`gradeConflict`: two *known and different* values block; an Unknown never
blocks) — planned features copy it.

### 4.3 The statistics (and why they're Excel-flavoured)
Parts pricing is right-skewed (a few inflated quotes drag the mean up), so
the **median** is the benchmark and the **IQR** (Q1–Q3) is the spread; the
**Tukey upper fence** (Q3 + 1.5·IQR) is a defensible "this price is an
outlier" line used by Assess ("ABOVE BOUND"). **CV** (SD/mean, %) makes
spread comparable between a $40 clip and a $4,000 bumper. Two deliberate
choices you must not "fix": quantiles use Excel's `PERCENTILE.INC` (R-7) and
SD is the *sample* SD (n−1, `STDEV.S`) — so a non-technical stakeholder can
reproduce every figure in a spreadsheet. And a single-quote cluster returns
SD/CV as `NaN`, **never 0** — one quote must not masquerade as perfect
agreement. Clusters below the **reliability floor** (`cfg.minQuotes`,
default 4) are marked advisory (`*`) and get no fence.

### 4.4 Trust machinery (review, dedupe, snapshots)
- **Reconciliation gate**: the sum of an invoice's extracted line totals is
  checked against the invoice's own *printed* subtotal (tolerance S$1 or
  0.5%). Mismatch ⇒ the whole bill is **held for review** — stored, visible
  in the Ingest review queue, but excluded from every benchmark until a human
  accepts or discards it.
- **Duplicate detection**: same supplier + bill number is never ingested
  twice (double-counted quotes skew medians).
- **Snapshot ids**: every dispute pack is stamped `PIX-<dataHash>-<cfgHash>`
  (FNV-1a over the dataset and the matching config). Same id = same data +
  same settings = same numbers, on any machine. **Consequence for you:** any
  new setting that changes benchmark numbers *must* live in `cfg` so
  `configFingerprint` hashes it automatically. This is a hard rule.
- **Schema validation** (`validateInvoice`): every OCR response is checked
  before ingest; fixable issues become warnings and are coerced on a copy,
  structural issues reject the invoice. Model output drift becomes a logged
  failure, not a corrupted benchmark discovered weeks later.

### 4.5 The matcher eval harness
The fuzzy matcher is the heart of the product, and it has a regression test:
`npm run eval:pairs` generates candidate part pairs into
`eval/gold_pairs.csv`; a human labels each `y`/`n`/`?` (policy in
`eval/README.md` — notably LH/RH mirror parts count as the *same* part for
pricing); `npm run eval:score` replays the **production** `pipeline.js` over
the labels and prints precision/recall across thresholds. The row that
matters is "dispute-grade": max recall at ≥95% precision — because a **false
merge** (wrong median used against a claim) is far worse than a **false
split** (thin median). Re-run this after *any* matcher change.

## 5. House rules (the conventions everything follows)

1. **Pure logic goes in `src/pipeline.js`.** No browser APIs there, ever —
   it's imported by Node tools. UI stays in the JSX.
2. **Every new pure function gets assertions in `tools/selftest.mjs`**, and
   `npm run test:tools` + `npm run build` must pass before you're done.
3. **Anything that changes benchmark numbers goes into `cfg`** (see 4.4).
4. **No new runtime dependencies** without a strong reason. The one heavy
   dep (jspdf, for PDF export) is dynamically `import()`ed so it lives in a
   lazy chunk — copy that pattern if you ever must add something heavy.
5. **Honesty in the UI**: thin data is labelled advisory, never hidden and
   never presented as authoritative; every number is at most one click from
   the source quotes behind it (the "drill-down everywhere" principle).
6. **Docs move with the code**: update `MANUAL.md`, `README.md` and
   `CHANGELOG.md` in the same change, and bump `package.json` +
   `APP_VERSION` (top of `PartsIndex.jsx`) — patch for fixes, minor for
   features.
7. **One prompt, one place**: OCR prompts live in `src/ocrPrompt.js` only.

## 6. Common tasks, concretely

**Run the test suite** — `npm run test:tools`. It's plain assertions; a
failure prints which one. Add new tests at the bottom following the existing
style (build a small fixture, assert on the pure function's output).

**Test the batch runner without spending tokens** —
`node tools/mock-server.mjs` in one terminal (note: if you script this, start
it with `setsid` so it doesn't hang your shell), then
`PARTSINDEX_API_BASE=http://127.0.0.1:8787 npm run ocr:batch -- --in ./invoices --limit 2`.
Also try `--dry-run` first: it prints the plan without any calls.

**Trace a number you don't believe** — click it. Every benchmark, flag and
KPI drills down to its underlying quotes. If the UI drill-down isn't enough,
find the cluster in `buildClusters`' output via the browser console, or
reproduce it in Node: `pipeline.js` is importable directly
(`node -e "import('./src/pipeline.js').then(p => ...)"`).

**Change the matcher** — make the change in `pipeline.js`, extend
`selftest.mjs`, then re-run `npm run eval:score` and compare precision/recall
before vs after. Never ship a matcher change without the eval numbers.

**Deploy** — push to GitHub, import into Vercel, set `ANTHROPIC_API_KEY` in
project settings. GitHub Pages also works (CI workflow included) but the OCR
button won't function there. Full steps in `README.md`.

## 7. Current state and what's next

**Version 1.8.1.** Working: full ingest (Excel + live OCR + batch runner),
hybrid matcher with grade/basis/model guards, nine tabs including the
stakeholder Demo lookup with Worklist and Excel/PDF export, eight analytics
views, Assess a Claim with Tukey-fence flags and the dispute pack, drill-down
everywhere, self-tests, eval harness.

**The near-term milestone is the 200-invoice OCR run.** The pre-run
checklist is in `MANUAL.md` §9; in short: fix the front/rear stopword bug in
the matcher (it causes a *permanent* false merge no threshold can undo),
label the gold set and calibrate the threshold, then trial the runner with
`--dry-run` → `--limit 5` → full folder.

**Known warts you should not be surprised by** (all documented in
`MANUAL.md` §9, with fixes specified in `OPUS_PROMPTS.md`):

- The matcher strips `fr`/`frt`/`front` as stopwords → front and rear
  variants of a part can merge (P1 fixes this with an axis-conflict veto).
- The shipped similarity threshold (0.65) is uncalibrated (P2).
- `api/ocr.js` is completely unauthenticated — anyone with the URL can spend
  the API key (P3). Fine for a private POC link; do not circulate the URL.
- A `localStorage` quota failure is silent — the app keeps running on
  in-memory data that dies on refresh (P4). Export to Excel often during big
  ingests.
- `PartsIndex.jsx` is a 1,230-line single file. It's deliberate for now;
  the decomposition plan is P6. Don't start a side-refactor.

**The roadmap** is `Fable.md` (features F1–F7: estimate OCR intake,
chassis/VIN enrichment, recency weighting, supplier scorecards, the POC#2
claim-outcomes module, a quarterly price index, and shareable benchmark
bundles), each with a ready-to-run implementation prompt in
`OPUS_PROMPTS.md` P8–P14. Read the Fable.md section before its prompt — the
rationale and the honesty rules live there.

## 8. Glossary

| Term | Meaning |
|---|---|
| TP / OD claim | Third-party (other driver's insurer pays) / Own-damage (your own policy pays) |
| PeerIndex / eSource | Existing Merimen data sources; both lack part numbers |
| npn | Normalised part number (`normPN` output) — the matching key |
| Cluster | A group of quote lines judged to be the same part = one benchmark |
| Bridging | In hybrid mode, merging different part numbers by name similarity (flagged `≈`) |
| Grade | OEM Genuine / OES / Aftermarket / Used-Recon — the biggest legitimate price driver |
| Unit basis | each / pair / set — per-pair prices never join per-each medians |
| Reliability floor | Min quotes (default 4) before spread stats and fences are trusted |
| Tukey fence | Q3 + 1.5·IQR — the statistical outlier bound behind "ABOVE BOUND" |
| Snapshot id | `PIX-<dataHash>-<cfgHash>` — reproducibility stamp on every export |
| Review queue | Bills failing totals reconciliation, held out of all benchmarks |
| Dispute pack | Three-sheet Excel (Summary / Line Assessment / Evidence) from Assess |
| Gold set | Human-labelled part pairs used to measure matcher precision/recall |
| Dispute-grade | The eval operating point: max recall at ≥95% precision |
