# Cost Estimation — 200 Supplier-Bill OCR Ingestion

> Companion to `tools/batch-ocr.mjs` and MANUAL.md §6 / §9. All prices are
> Anthropic Claude API list prices as of **July 2026** — verify against
> https://docs.claude.com/en/docs/about-claude/pricing before the run, since
> pricing can change. All figures in **USD**; token counts are estimates from
> the shipped OCR prompt and the 18-bill demo corpus.

---

## 1. What one invoice costs to OCR

Every request the runner sends is: **system prompt + user instruction + the
document itself**, and gets back **one minified JSON invoice**.

| Component | Basis | Estimated tokens |
|---|---|---|
| System prompt (`OCR_SYS`, src/ocrPrompt.js) | 3,974 chars | ~1,100 |
| User instruction (`OCR_USER_TEXT`) | 87 chars | ~25 |
| Document (PDF page = extracted text **+** page image) | ~1,500–3,000 tokens **per page**; supplier bills average 1–2 pages | ~2,500–5,000 |
| **Input per invoice** | | **~4,000–6,000 (plan on 5,000)** |
| Output — minified JSON: header ~80 tokens + ~35–45 tokens per line item | demo corpus averages ~10 lines/bill, long bills run 25+ | **~500–1,200 (plan on 700)** |

A photographed/scanned image (JPG/PNG) instead of a PDF prices similarly:
image tokens ≈ width × height ÷ 750, capped around ~1,600 tokens at the
1568-px long edge, plus the fixed prompt.

**Planning figures for 200 invoices:**
- Input: 200 × 5,000 = **~1.0M tokens**
- Output: 200 × 700 = **~0.14M tokens**

---

## 2. Model pricing (list, July 2026)

| Model | Standard $/MTok (in / out) | **Batch** $/MTok (in / out, 50% off) |
|---|---|---|
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | 1.00 / 5.00 | 0.50 / 2.50 |
| Claude Sonnet 4.6 (`claude-sonnet-4-6`) — **recommended** | 3.00 / 15.00 | 1.50 / 7.50 |
| Claude Opus 4.8 (`claude-opus-4-8`) | 5.00 / 25.00 | 2.50 / 12.50 |

The Message Batches API halves both input and output pricing; batches usually
complete well within an hour (worst case 24 h). The runner's `--mode batch`
uses it natively.

---

## 3. Scenarios for the 200-invoice run

Using the 1.0M-in / 0.14M-out planning figures:

| Scenario | Input cost | Output cost | **Total** |
|---|---|---|---|
| **A. Sonnet 4.6, batch mode (recommended)** | 1.0M × $1.50 = $1.50 | 0.14M × $7.50 = $1.05 | **≈ $2.55** |
| B. Sonnet 4.6, live mode (no batch discount) | $3.00 | $2.10 | ≈ $5.10 |
| C. Opus 4.8, batch mode (everything on Opus) | $2.50 | $1.75 | ≈ $4.25 |
| D. Haiku 4.5, batch mode (clean prints only) | $0.50 | $0.35 | ≈ $0.85 |

**Recommended plan = A + a small Opus retry pass:** run all 200 through
Sonnet 4.6 in batch mode, then re-run only the failures/review cases
(historically ~5–10%, so ~10–20 files) through Opus 4.8 live with
`--retry-failed`:

- Opus retry pass, 20 files, live: 0.10M × $5 + 0.014M × $25 ≈ **$0.85**
- **Total recommended budget: ≈ $3.40**, i.e. under **$5 with headroom** for
  page-heavy bills, resubmissions and trial runs. A hard ceiling of **$10**
  covers even a pathological corpus (multi-page faxes, full Opus re-run).

Per-invoice this is **≈ 1.3–2.5 US cents** — negligible next to the analyst
time it replaces.

### Sensitivity

- **Page count dominates.** If the corpus averages 3+ pages/bill, input
  roughly doubles → scenario A lands nearer $4–5. Still inside the $10
  ceiling.
- **Output is bounded** by `--max-tokens` (default 8192). A truncation is
  reported as a failure, never silently billed as a success — re-run that file
  with a higher cap.
- The runner prints real token totals per run; pass
  `--price-in 1.5 --price-out 7.5` (batch Sonnet rates) and
  `run_report.json` carries an `estimated_cost_usd` computed from **actual**
  usage, replacing every estimate above.

### What the estimate excludes

- **Human QC time** — the 5% eyeball sample (≈10 invoices) is mandatory
  regardless of model tier: the reconciliation gate catches misread amounts
  but **not** a misread part number attached to a correct price.
- Vercel/Turso hosting (free tier at this scale) and re-runs you choose to do
  after changing the prompt.

---

## 4. Step-by-step: running the 200-invoice ingestion

### Pre-run checklist (blockers first)

1. **Settle the LH/RH labeling policy** (`cfg.sepSide`, currently off =
   side-pooling) so matcher output is scored consistently — see MANUAL.md §9.
2. **Confirm the P2 positional-veto item** from the technical-deck gap list is
   resolved or explicitly waived; P1 was fixed in v1.12.0.
3. **Label the 138-pair gold set** (`eval/gold_pairs.csv`) and run
   `npm run eval:score` so the 0.65 threshold is calibrated before the corpus
   lands, not after.
4. `npm run test:tools` — all self-tests green on the exact tree you'll run.

### Setup

```bash
git pull && npm install
export ANTHROPIC_API_KEY=sk-ant-...        # console.anthropic.com → API keys
mkdir -p invoices                           # drop all 200 PDFs/images here
```

Accepted extensions: `.pdf .png .jpg .jpeg .webp .gif`. Files over ~28 MB are
rejected up front — split those PDFs first.

### Step 1 — Dry run (free)

```bash
node tools/batch-ocr.mjs --in ./invoices --dry-run
```

Confirms the file count (expect 200), flags oversized files, and shows what a
resume would skip. No API calls.

### Step 2 — Trial on 5 files (≈ $0.10)

```bash
node tools/batch-ocr.mjs --in ./invoices --limit 5 --price-in 3 --price-out 15
```

Live mode, immediate results. Open `ocr_out/PartsIndex_import.xlsx` and
eyeball all 5 against the source documents: supplier, bill number, every part
number **verbatim**, unit costs, and that struck-through/returned lines follow
the v1.12.0 totals policy. Fix the prompt or the documents before scaling up —
the manifest means the 5 trial files won't be re-billed later.

### Step 3 — Full batch run (≈ $2.50)

```bash
node tools/batch-ocr.mjs --in ./invoices --mode batch \
  --price-in 1.5 --price-out 7.5
```

- Submits everything not already done to the Message Batches API and polls
  until it ends (typically < 1 h, worst case 24 h).
- **Safe to Ctrl-C / crash / re-run**: `ocr_out/manifest.json` records every
  file by SHA-256; a re-run resumes polling pending batches and skips
  completed files instead of resubmitting.
- Duplicate bills (same supplier + bill number) are detected and skipped
  automatically.

### Step 4 — Retry failures on Opus (≈ $0.85)

```bash
node tools/batch-ocr.mjs --in ./invoices --retry-failed \
  --model claude-opus-4-8 --price-in 5 --price-out 25
```

Live mode so each fix is visible immediately. If a file failed with
"truncated at max_tokens", add `--max-tokens 16384`. Anything still failing
after Opus goes to manual entry via the app's **Add lines manually** path.

### Step 5 — Import into PartsIndex

1. Open the app → **Ingest** tab → **Bulk upload** →
   `ocr_out/PartsIndex_import.xlsx`.
2. Rows with `Review = yes` failed totals reconciliation (extracted lines
   don't sum to the printed total) — the app holds them in the **review
   queue**. Resolve each against the source document.
3. **Mandatory 5% sample:** pick ~10 random *passing* invoices and check them
   line-by-line against the PDFs. The reconciliation gate cannot catch a
   misread part number carrying the correct price.
4. On the localStorage build, watch the activity log for a save **error
   event** — 200 invoices plus a review queue approaches the ~5 MB quota.
   Export to Excel immediately if one fires (MANUAL.md "Known limits");
   prefer the Turso/libSQL build for a corpus this size.

### Step 6 — Close out

- File `ocr_out/run_report.json` (actual tokens + cost) with the run record.
- Note the dataset's `configFingerprint` snapshot ID after import so dispute
  packs generated from this corpus are reproducible.
- Archive `ocr_out/json/` — the per-invoice validated JSON is the audit trail
  back to each source document (`_source_file`, `_sha256`).

---

## 5. Quick reference

| Item | Value |
|---|---|
| Recommended model | Sonnet 4.6, `--mode batch` |
| Retry model | Opus 4.8, live, `--retry-failed` |
| Expected cost | **≈ $3.40** (budget $5, ceiling $10) |
| Expected wall-clock | batch < 1 h typical (≤ 24 h worst case) + QC time |
| Expected review rate | ~5–10% of invoices (reconciliation mismatches) |
| Mandatory QC | 5% line-by-line eyeball sample, no exceptions |
