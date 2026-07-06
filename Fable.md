# Fable.md — PartsIndex feature roadmap (v1.8.0 analysis)

*Written against PartsIndex v1.8.0, July 2026. Codebase analysed: `src/pipeline.js`
(489 lines, pure), `src/PartsIndex.jsx` (~1,230 lines, UI + glue),
`tools/batch-ocr.mjs`, `eval/`, `api/ocr.js`, and all project docs.*

This document proposes **new features** — capabilities the product does not have
yet. It deliberately does **not** repeat the known fixes and hardening work
already specified in [`OPUS_PROMPTS.md`](./OPUS_PROMPTS.md) P1–P7 (axis-veto
matcher fix, threshold calibration, proxy hardening, localStorage quota guard,
GST normalisation, JSX decomposition, snapshot persistence). Where a proposal
builds on one of those, the dependency is stated.

Each feature below has a matching implementation prompt in `OPUS_PROMPTS.md`
(P8–P14).

## Where the product stands

PartsIndex has finished proving the hard part: supplier bills *can* be read at
scale (validated OCR + reconciliation gate + resumable runner), the extracted
lines *can* be matched into benchmarks (hybrid PN-first matcher with grade /
unit-basis / model guards and an eval harness over the production code), and a
benchmark *can* be put to work (Assess a Claim, Tukey-fence outlier calls,
reproducible dispute packs). What it does **not** yet do falls into three
themes, and the seven features below map onto them:

1. **Close the loop on the claim** — the benchmark exists, but the estimate
   still arrives as pasted text, and the project's success criterion (b) —
   accuracy against real settlement outcomes — is unmeasured. → **F1, F5**
2. **Make the benchmark smarter as data ages and grows** — 200 invoices
   spanning years demand recency awareness; volume unlocks supplier-level and
   market-level views a per-part median can't show. → **F3, F4, F6**
3. **Make the data and the output travel** — better vehicle identity from
   chassis numbers, and benchmark output that leaves the browser it was built
   in. → **F2, F7**

---

## F1 — OCR the estimate: document intake for Assess a Claim

**When: pre- or post-run (independent). Effort: S–M. Risk: low.**

### The gap
Assess a Claim is the tab with teeth, but its input is a `textarea`: the
adjuster must re-type or copy-paste `part no · description · price` lines from
a repairer estimate that is itself a PDF or a photo. Every re-key is friction
and a transcription-error risk — ironic for a product whose whole thesis is
that Claude reads motor documents better than people re-type them.

### The feature
An **"Upload estimate"** button on the Assess tab that accepts a PDF/image of
the repairer estimate, sends it through the *existing* OCR proxy, and fills the
assessment lines automatically. The adjuster reviews the parsed lines in an
editable preview (the OCR is a head start, not an oracle), then runs the
assessment exactly as today.

### Design sketch
- **New prompt, same plumbing.** A repairer estimate is a different document
  from a supplier bill: it quotes *sell* prices, often mixes parts with labour
  and paint lines, and has no supplier identity worth capturing. Add
  `ESTIMATE_SYS` to `src/ocrPrompt.js` (keeping the single-source-of-truth
  discipline) with a minimal schema: `{ workshop, estimate_ref, date, vehicle,
  make, model, lines: [{ part_name, part_number, qty, quoted_price, line_kind:
  "part"|"labour"|"paint"|"other" }], parts_subtotal }`.
- **Reuse `ocrFile()`** (src/PartsIndex.jsx ~line 55) with the estimate prompt;
  reuse the model picker. Note P3 (proxy hardening) pins the server-side system
  prompt to `OCR_SYS` — if P3 lands first, the proxy must accept a *named*
  prompt id (`bill` | `estimate`) rather than free text, preserving the
  can't-be-a-general-gateway property.
- **Validation twin.** `validateEstimate()` in `src/pipeline.js`, modelled on
  `validateInvoice`: coercible problems → warnings, structural problems →
  reject. Reconciliation check against `parts_subtotal` where printed, reusing
  the S$1 / 0.5% tolerance idea.
- **Editable preview.** Parsed lines land in an editable grid; `labour`/`paint`
  lines are shown but pre-unticked (the benchmark only speaks to parts). Only
  ticked lines flow into the existing `matchLine` path — zero change to the
  assessment or dispute-pack logic downstream. The estimate's make/model, when
  read, pre-fills the assessment context so matching can prefer same-make
  clusters.

### Why it earns its place
It converts Assess from a demo you drive with prepared text into a tool an
adjuster points at the actual claim document. It also produces the *left-hand
side* of the matched triples F5 needs, in structured form, for free.

---

## F2 — Chassis/VIN-aware make & model enrichment

**When: ideally pre-run (the 200 invoices land cleaner); re-derivable post-run
from the runner's saved JSONs. Effort: M. Risk: low.**

### The gap
Make/model is often absent from the bill and is inferred from a hand-rolled
part-number-prefix map (`MAKE_PREFIX` in `src/pipeline.js`). Yet the OCR prompt
*already extracts* `vehicle` and `chassis` fields — and then `enrichPart`
throws them away: no per-line `chassis` survives into the dataset. A 17-char
VIN's first three characters (the WMI — World Manufacturer Identifier) identify
the manufacturer deterministically; positions 4–8 often narrow the model.
MANUAL.md §9 explicitly names "joining full claim metadata via chassis" as the
way to make same-model separation exact.

### The feature
Persist `vehicle`/`chassis` per line, decode make from a WMI table when
present, and let a chassis prefix act as a *model* discriminator even when the
model name is unknown — so two bills for the same physical car cluster
together, and same-model separation stops relying on free-text model strings.

### Design sketch
- **Carry the fields.** `enrichPart` and `upgradePart` gain `vehicle` and
  `chassis` (default `""`); the Excel importer (`parseExcel`) learns optional
  `Chassis` / `Vehicle` columns; the batch runner already has the values in its
  per-invoice JSON, so its `PartsIndex_import.xlsx` gains the two columns —
  the 200-run output round-trips them losslessly.
- **`WMI_MAP` + `inferMakeFromChassis()`** in `src/pipeline.js`: a small,
  data-driven ordered table for the makes that matter in SG motor claims
  (Toyota `JT*`/`MR0`, Honda `JHM`/`MRH`, Mercedes `WDB`/`WDD`/`W1K`, BMW
  `WBA`/`WBS`, Audi `WAU`, VW `WVW`, Hyundai `KMH`, Kia `KNA`, Mazda `JM0`/
  `JM7`, Nissan `JN1`/`SJN`, Mitsubishi `JMB`, Subaru `JF1` …). Precedence in
  `inferMake` becomes: printed make → WMI decode → part-number prefix →
  Unknown. A non-17-char "chassis" (SG bills sometimes print the *registration*
  plate here) is detected and ignored for decoding but still stored.
- **`chassisModelKey()`**: when *Same model* is on and both parts carry a
  17-char VIN, positions 1–8 (WMI + VDS) form a model key that overrides the
  free-text `modelKey` — exact where text is fuzzy. Free-text behaviour is
  unchanged when VINs are absent, so nothing regresses on the demo set.
- **Surface it.** Parts Ledger full-record drill-down shows vehicle/chassis;
  the dispute-pack Evidence sheet gains a `Chassis` column (provenance for a
  court is stronger when the evidence line names the donor vehicle).

### Honest caveat
WMI decoding gives **make** reliably; **model** from VDS is
manufacturer-specific and should only ever *separate* (as a key), never be
displayed as a decoded model name. The design above respects that line.

---

## F3 — Recency-aware benchmarks: date window + time-decay weighting

**When: post-run (needs the multi-year spread the 200 invoices bring).
Depends on: P5's `parseDate` hardening (dot/dash/ISO formats). Effort: M.
Risk: medium — every number changes when enabled, so snapshot discipline is
critical.**

### The gap
MANUAL.md §9: "Bills span multiple years… Normalising to ex-GST and **weighting
by recency** is a worthwhile next step." P5 delivers the GST half. The recency
half is untouched: a 2018 quote and a 2025 quote vote equally in today's
median, understating current prices in an inflationary parts market — exactly
the direction that makes an insurer's reference look unfairly low in a
negotiation.

### The feature
Two independent, benchmark-tab-configurable mechanisms, both folded into the
snapshot fingerprint:

1. **Date window** — "use quotes from the last *N* months" (off / 12 / 24 /
   36). Simple, explainable, and the first thing a stakeholder will ask for.
2. **Time-decay weighting** — an exponential half-life (e.g. 24 months) that
   weights each quote by `0.5^(ageMonths/halfLife)`, feeding a **weighted
   median**. Softer than a hard window: old quotes fade rather than vanish, so
   thin clusters keep their sample.

### Design sketch
- **Pure functions first** (`src/pipeline.js`): `ageMonths(dateStr, asOf)`,
  `recencyWeight(dateStr, halfLifeMonths, asOf)`, and `weightedMedian(values,
  weights)` (sort by value, walk cumulative weight to 50% — the standard
  lower-weighted-median with interpolation at ties). All selftest-able against
  hand-computed fixtures. **`asOf` is a parameter, not `new Date()`** — a
  snapshot re-run next month must reproduce the same numbers, so the effective
  date is recorded in `cfg` and hence hashed into the snapshot id
  automatically by `configFingerprint`.
- **`makeCluster` integration**: when decay is on, `med` becomes the weighted
  median and the cluster carries `medRaw` alongside, so drill-downs can show
  "weighted S$X (unweighted S$Y)" — a reference an adjuster can't reconcile is
  a reference they won't defend, and weighted medians *don't* reconcile in
  Excel one-for-one, so the raw figure must stay one click away. Quotes with
  unparseable dates get weight = the minimum observed weight and a flag (never
  silently full weight, never silently excluded).
- **Dispersion stays unweighted.** IQR/SD/CV and the Tukey fence continue to
  run on raw units: weighted dispersion isn't Excel-reconcilable and the fence
  is a legal-defensibility feature. Documented explicitly.
- **UI**: two controls on the Benchmark tab config card; the Benchmark caption
  and dispute-pack Summary state the basis ("median weighted, 24-month
  half-life, as of 2026-07-01"); windowed-out or zero-weight quotes are shown
  greyed in drill-downs rather than hidden.

### Why it earns its place
It is the difference between "the median of everything we've ever seen" and "a
current market reference" — and it's the first methodological question any
actuary reviewing the POC will ask.

---

## F4 — Supplier scorecards (Analytics view 09)

**When: post-run (needs supplier overlap). Effort: M. Risk: low.**

### The gap
The dispersion view (04) says *this part's* quotes disagree; nothing says
*this supplier* is systematically the one on the expensive end. With 200
invoices, suppliers recur, and the most actionable pattern in the data —
"Supplier X averages +18% over the market on parts where a comparison exists"
— currently requires exporting to Excel and pivoting by hand.

### The feature
A per-supplier scorecard: for every quote a supplier has in a **reliable,
multi-supplier** cluster, compute its deviation from the cluster median
excluding that supplier's own quotes (otherwise a dominant supplier is graded
against itself); aggregate to a supplier **premium index** (median of those
deviations, %), with volume, coverage (makes/categories), grade mix, and a
consistency measure (IQR of the deviations).

### Design sketch
- **Pure**: `supplierScorecards(clusters, { minQuotes })` in `src/pipeline.js`
  returning `[{ supplier, lines, clustersCompared, premiumPct, premiumIqr,
  gradeMix, makes, cats, flags }]`. Comparison rules are strict and stated:
  only clusters with ≥2 distinct suppliers and `reliable:true`; leave-own-out
  median as the baseline; per-pair vs per-each never crosses (already
  guaranteed by clustering); a supplier with <5 comparable lines is `advisory`
  — the same honesty pattern as the cluster reliability floor.
- **UI**: ninth numbered view on the Analytics tab ("09 Supplier scorecard"),
  table sorted by |premium|, colour-banded like CV (within ±5% neutral, +5–15%
  amber, >+15% red), each row expanding — in the house style — to the
  underlying (cluster, this-supplier price, others' median) triples so every
  index is one click from its evidence.
- **Method Notes** entry: what the index is, the leave-own-out rationale, and
  the explicit caution that grade and recency differences can explain a
  premium (link to the grade guard and F3) — this view flags *questions*, not
  verdicts.

### Why it earns its place
It converts the benchmark from a per-part lookup into procurement
intelligence: which suppliers to steer panel workshops toward, and which
supplier's bills deserve a harder look — a second product surface on the same
data.

---

## F5 — POC#2: matched triples & measured inflation (Claim Outcomes)

**When: post-run; the flagship follow-on. Depends on: F1 (structured
estimates) helpful but not required. Effort: L. Risk: medium (needs outcome
data from the business).**

### The gap
The brief's success criterion (b): *accuracy — how close the reference sits to
the repairer quote / insurer final offer*. MANUAL.md §9 and README both state
it plainly: quantifying TP inflation in dollars needs **matched triples** per
claim — supplier-bill cost, repairer estimate, insurer final offer. The Assess
tab compares an estimate to the benchmark; nothing captures what the claim
*actually settled at*, so the POC cannot yet say "PartsIndex would have saved
S$X on these N claims" — the sentence that gets it funded past POC.

### The feature
A **Claim Outcomes** ledger and report:

1. Every Assess run can be **saved as a case** (claim ref, date, the assessed
   lines, matched benchmarks, snapshot id — mostly data the dispute pack
   already assembles).
2. A case later receives its **outcome**: final offer total (or per-line where
   available), settled date, and a disposition (negotiated / paid as quoted /
   disputed).
3. A **Validation report** aggregates closed cases: per-claim and portfolio
   `estimate vs benchmark vs final offer`, measured inflation (estimate −
   final), benchmark accuracy (|benchmark − final| as % of final, the
   criterion-(b) number), calibration by band ("of lines we flagged ABOVE
   BOUND, X% were negotiated down"), and the headline **realised + potential
   saving**. Exportable as a one-sheet Excel for the steering committee.

### Design sketch
- **Pure**: `buildCase(rows, cfg, meta)` (a sibling of `buildDisputePack` —
  much of the shape is shared and should be factored, not duplicated),
  `caseOutcomeStats(case_, outcome)`, `portfolioReport(cases)` in
  `src/pipeline.js`, all fixture-tested.
- **Storage**: cases are small (an assessed claim, not the dataset) but must
  outlive a session. If P7 (IndexedDB) has landed, a `cases` store beside
  `snapshots`; if not, a dedicated localStorage key routed through the P4
  storage module with the same quota handling. Each case pins its
  `snapshotId`, so with P7 the exact benchmark state it was assessed against
  is re-openable — the reproducibility story, completed.
- **UI**: a "Save as case" button on Assess (next to the dispute-pack export);
  a **Cases** panel (list, status, add-outcome form, per-case detail) and the
  portfolio report view. Per-line outcomes are optional — the common reality
  is a single final-offer figure, and the stats must degrade gracefully to
  totals-only.
- **Honesty rules**: cases assessed under different snapshot ids are reported
  but sectioned by snapshot; a portfolio with <10 closed cases is watermarked
  advisory; "saving" is always split into *realised* (final < estimate) vs
  *attributed* (the report never claims causation the data can't support).

### Why it earns its place
Everything else in this roadmap improves the instrument. F5 is the experiment
the instrument was built for.

---

## F6 — The PartsIndex Price Index: category/make index over time

**When: post-run (needs date spread + volume). Depends on: F3's date maths;
strengthened by P5 (ex-GST prices). Effort: M. Risk: medium (methodology needs
care with a chained index).**

### The gap
The trend view (05) shows scatter strips per category — individual dots, no
aggregate. What Merimen can uniquely publish, and what no per-part median
gives, is a **market-level index**: "SG aftermarket body-parts prices rose 6.1%
year-on-year". That is a reserving and pricing input for insurers, and it makes
the product's name literal.

### The feature
A quarterly **chained median-ratio index** per segment (category × grade band,
optionally × make), base 100 at the first quarter with sufficient data:

- For adjacent quarters, take every cluster with reliable medians in **both**
  quarters (a matched sample — this is what makes it an index and not a mix
  shift), compute the median of the per-cluster price ratios, and chain.
- Segments below a minimum matched-cluster count in a quarter carry the index
  forward flagged *thin* rather than printing a number built on two parts.

### Design sketch
- **Pure**: `quarterKey(date)`, `chainedIndex(clusterQuarterMedians, opts)` in
  `src/pipeline.js`, with fixtures including a deliberate mix-shift trap (a
  cheap part entering the sample in Q3 must *not* read as deflation — the
  matched-sample rule is the test).
- **Prices**: use ex-GST units when P5's toggle is on (else the 2023/2024 GST
  steps masquerade as market inflation — the report footnotes which basis was
  used); use unweighted quarter medians (F3 decay is for the *current*
  benchmark, not the historical series).
- **UI**: an **Index** panel on the Trend view (or a tenth Analytics view): a
  simple SVG line chart per segment (no charting dependency — the app has a
  no-new-deps habit worth keeping), a table of quarterly values with matched-
  cluster counts, and per-quarter drill-down to the contributing cluster
  ratios in the house one-click-to-evidence style.
- **Export**: a one-sheet Excel (segments × quarters, counts, basis, snapshot
  id) — the artefact an actuary actually wants.

---

## F7 — Shareable read-only benchmark bundle

**When: post-run. Depends on: P7 (snapshots) conceptually; works without it.
Effort: S–M. Risk: low.**

### The gap
The benchmark lives and dies in one browser's localStorage. The Demo tab was
built to *show* stakeholders, but showing means screen-sharing or exporting
Excel; a claims manager can't open the living lookup on their own machine, and
publishing the whole app with the dataset embedded would hand out the raw
bills, not the benchmark.

### The feature
**Export benchmark bundle**: a single self-contained JSON of the *computed
clusters* (labels, make/model, medians, IQR/SD/CV, reliability, quote count,
supplier count, basis, snapshot id — optionally the evidence quotes, as a
checkbox) — and a **viewer mode** in the same app: open the deployed URL, drop
the bundle on the Demo tab (or `?bundle=` a hosted file), and get the full
Demo lookup + Worklist experience, read-only, with a persistent "Viewing
benchmark bundle PIX-… (read-only) · generated <date>" banner. No Ingest, no
Assess, no mutation.

### Design sketch
- **Pure**: `exportBundle(clusters, cfg, meta, { includeEvidence })` and
  `validateBundle(json)` (version-stamped schema, same
  warnings-vs-errors discipline as `validateInvoice`) in `src/pipeline.js`.
  The bundle carries the snapshot id it was computed from, so a figure a
  stakeholder reads in the viewer traces to the same reproducibility chain as
  a dispute pack.
- **Privacy dial**: without evidence, the bundle contains only aggregate
  statistics — shareable widely; with evidence, it embeds supplier/bill-level
  quotes — shareable like a dispute pack. The export dialog says exactly this.
- **Viewer**: App state gains a `bundle` mode; Demo and Worklist components
  read clusters from the bundle instead of `buildClusters(parts, cfg)`;
  matching-config controls hidden (the config travelled inside the bundle).
  Because the Demo tab already resolves everything through cluster objects,
  this is mostly routing, not new UI.

### Why it earns its place
It is the cheapest possible "productisation" step: the benchmark becomes an
artefact that travels — to a claims team, to an underwriter, to the steering
committee — while the raw dataset stays where it was ingested.

---

## Suggested sequencing

| Order | Item | Why here |
|---|---|---|
| 1 | P1–P4 (existing prompts) | Pre-run correctness + safety; unchanged. |
| 2 | **F2** (chassis/VIN) | Small, pre-run: the 200 invoices land with better vehicle identity; the runner's Excel round-trips it. |
| 3 | *The 200-invoice run* | The milestone everything is staged around. |
| 4 | P5 (GST) + **F3** (recency) | The two halves of price comparability, in that order — F3 reuses P5's date parsing. |
| 5 | **F1** (estimate OCR) + **F5** (claim outcomes) | Close the claim loop; F5 is the POC#2 deliverable and the funding argument. |
| 6 | **F4** (supplier scorecards), **F6** (price index) | Volume-powered analytics; independent of each other. |
| 7 | P6, P7, **F7** | Structural refactor, snapshot persistence, then the shareable bundle that leans on both. |

## Deliberately not proposed

- **A backend / SQLite now** — the README's `localStorage → SQLite → Postgres`
  progression is right; nothing above forces the jump before the POC verdict.
- **Auth / multi-user** — P3's shared secret is the honest POC posture; real
  auth belongs to productisation, not this roadmap.
- **Charting or state-management libraries** — the app's no-new-deps,
  pure-functions-first discipline is a feature; every proposal above respects
  it (jspdf's lazy-chunk precedent is the template for anything heavy).
