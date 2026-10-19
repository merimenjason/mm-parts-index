# Data-validity checks — October 2026

The files behind the October 2026 updates in [`QA.md`](../../QA.md):
§7 (OCR accuracy), §9 (part-number lookups and which average to use) and §11
(open items). Two questions from the review call:

1. **Are the wide price ranges real?** For example, headlamps at S$85–3,600.
2. **Is the OCR reading the bills correctly?**

Everything here reads the live reference with GET only, or works from saved
copies. Nothing writes to the shared database.

> **Reviews still pending.** The suggested answers in the `_with_lookups`
> workbooks come from online lookups, not from a person. Until a reviewer fills
> the yellow answer columns, every figure in QA.md from these files is provisional.

## Workbooks

| File | What it is | Who uses it |
| --- | --- | --- |
| `Price_range_check_2026-10-15_plain_with_lookups.xlsx` | **Price-range review.** 106 lines from 16 benchmarks. "What is this part" and "Which car" are filled in from the catalogue, along with a suggested reason. The reviewer picks the final reason in the yellow REASON column. | Reviewer |
| `OCR_accuracy_check_2026-10-15_plain_with_lookups.xlsx` | **OCR review.** 25 rows where the two readings disagree, each with what the lookup found and a suggested answer. Also lists the 34-line blind spot check. The reviewer answers in the yellow YOUR ANSWER column. | Reviewer |
| `Price_range_check_2026-10-15_plain.xlsx`, `OCR_accuracy_check_2026-10-15_plain.xlsx` | The same two workbooks before the lookups were added. | — |
| `PartsIndex_data_validation_2026-10-15.xlsx` | Analyst version of the price-range sample: the sampled benchmarks with spread statistics. | Analyst |
| `PartsIndex_ocr_check_2026-10-15.xlsx` | Analyst version of the OCR sample: 45 bills, 474 lines. | Analyst |
| `PartsIndex_ocr_check_2026-10-15_opus55.xlsx` | The analyst OCR sample with the Opus 5.5 second reading compared line by line. | Analyst |
| `Benchmark_statistic_recommendation_2026-10-16.docx` | Two-page write-up: mean vs median vs trimmed mean. | Stakeholders |

In the reviewer workbooks, links to the source bills point to this machine's
`invoices/` folder. They only open where those bills are stored.

## Data

| File | What it is |
| --- | --- |
| `live_parts_2026-10-15.json` | Snapshot of `/api/parts` on 15 Oct 2026 (1,536 lines). All the figures are computed from this. |
| `online_lookups_2026-10-15.json` | Catalogue lookup of the 86 distinct part numbers in the price-range sample (Amayama for Toyota / Mercedes-Benz, web search for Tesla / Audi). |
| `ocr_lookups_2026-10-15.json` | Catalogue lookup of both readings for each checkable disagreement in the OCR sample. |
| `verify_out/` | Opus 5.5's second reading of each of the 45 sampled bills, one JSON per bill, with token usage. |
| `run_opus55.log` | Log of that run (US$1.74, effort medium). |

## Scripts, in the order they were run

Install once in this folder: `npm install`. The app's own `xlsx` dependency
comes from the repo root's `node_modules`, so run `npm install` there too.

The scripts look for the source bills and the batch-OCR output in the repo
root's `invoices/` and `ocr_out/` folders, the defaults of `tools/batch-ocr.mjs`.
If yours are elsewhere, set `INVOICES_DIR` and `OCR_OUT_DIR`.

| Step | Command | Writes |
| --- | --- | --- |
| 1. Price-range sample | `node build_worksheet.mjs` | `PartsIndex_data_validation_<date>.xlsx`, `live_parts_<date>.json` |
| 2. OCR sample | `node build_ocr_check.mjs` | `PartsIndex_ocr_check_<date>.xlsx` |
| 3. Second reading (Opus 5.5) | `node ocr_verify.mjs --dry-run`, then `node ocr_verify.mjs` | `verify_out/`, `..._opus55.xlsx` (needs `ANTHROPIC_API_KEY`; cached bills are not re-sent) |
| 4. Plain-language OCR workbook | `node build_plain.mjs` | `OCR_accuracy_check_..._plain.xlsx` |
| 5. Plain-language price-range workbook | `node build_plain_dv.mjs` | `Price_range_check_..._plain.xlsx` |
| 6. Add the lookups | `node fill_lookups.mjs`, `node fill_ocr_lookups.mjs` | the two `_with_lookups.xlsx` |
| 7. Which average | `node bench_compare.mjs` | prints the comparison table |
| 8. Word write-up | `node build_benchmark_doc.cjs` | the `.docx` |

Steps 1 and 2 fetch the **current** live data, so a re-run picks a sample from
today's reference, not the 15 October one. Steps 4–8 rebuild from the files in
this folder. Steps 4–6 **overwrite** the reviewer workbooks, so copy a workbook
before re-running if someone has started filling it in.

The lookups themselves (step 6's JSON) were done by hand in a browser, not by
a script. Amayama prices are genuine parts from its Japan warehouse in SGD,
excluding shipping and GST, so treat them as a rough guide only.
