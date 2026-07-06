# OCR Extraction Prompt — Supplier Bills → PartsIndex Excel

Use this when handing the **200 supplier invoices** to Claude for OCR. It is tuned to produce output that maps **1:1** onto the columns PartsIndex expects, so the resulting spreadsheet imports with no manual cleanup.

> **The canonical prompt lives in [`src/ocrPrompt.js`](./src/ocrPrompt.js)** — imported by both the app's live-OCR button and the bulk runner, so all paths extract identically. If you tune the prompt, tune it there; this file documents it.
>
> **For the 200-invoice run itself, don't drive this by hand** — use the batch runner: `npm run ocr:batch -- --in ./invoices` (add `--mode batch` for 50% token cost via the Message Batches API). It applies this prompt, validates every response against the schema, runs the reconciliation gate, dedupes on supplier + bill number, resumes after crashes, and emits an app-ready `PartsIndex_import.xlsx`. See the README's *Batch OCR runner* section.

There are two ways to run it manually. **Option A** (structured JSON, then convert to Excel) is the most reliable for bulk work and is what the app's built-in "OCR invoices" button and the batch runner use. **Option B** asks Claude to emit a spreadsheet-ready table directly.

---

## Target columns (what the app reads)

The importer matches columns flexibly, but these are the canonical headers. One **row per part line**; bill-level fields repeat down the rows of the same invoice.

| Column | Meaning | Notes |
|---|---|---|
| `Supplier` | Supplier / workshop name | e.g. "Min Ghee Auto Pte Ltd" |
| `Bill No` | Invoice / bill number | unique per document |
| `Bill Date` | Invoice date | keep as printed (DD/MM/YYYY) |
| `Make` | Car make | only if printed or inferable from chassis; else blank |
| `Model` | Car model / variant | else blank |
| `Doc Type` | `Tax Invoice` or `Repair Estimate` | estimates are excluded from the cost benchmark |
| `Part Name` | Part description as printed | verbatim |
| `Part Number` | Manufacturer part no. | verbatim, keep spaces/dashes as printed |
| `Qty` | Quantity | number |
| `Unit Cost` | Unit price | leave blank/0 if not printed — app derives it |
| `Total Cost` | Line total | number |
| `Grade` | `OEM Genuine` / `OES` / `Aftermarket` / `Used/Recon` / `Unknown` | only when the bill marks it; never guessed |
| `Unit Basis` | `each` / `pair` / `set` | per-pair prices must not join per-each medians |
| `GST` | `incl` / `excl` / `unknown` | whether line prices include GST |

---

## Option A — Structured JSON (recommended for bulk)

**System prompt:**

```
You are an OCR and data-extraction engine for Singapore motor-parts supplier
invoices and repair estimates. Return ONLY a single valid JSON object — no
markdown, no code fences, no commentary before or after.

Schema:
{
  "supplier_name": string,
  "supplier_id": string,          // company/GST reg no if printed, else ""
  "bill_no": string,
  "bill_date": string,            // as printed, DD/MM/YYYY
  "repairer": string,             // the "bill-to" workshop, if shown
  "vehicle": string,              // free text as printed
  "chassis": string,              // chassis / vehicle reg no if shown, else ""
  "make": string,                 // only if printed or clearly inferable from
                                  // chassis/part prefix; else ""
  "model": string,                // else ""
  "doc_type": "Tax Invoice" | "Repair Estimate",
  "gst_treatment": "incl" | "excl" | "unknown",
                                  // do the LINE prices include GST, or is GST
                                  // added after the subtotal?
  "parts_subtotal": number,       // printed sum of the parts lines BEFORE GST;
                                  // 0 if not printed. Used by the app's
                                  // reconciliation gate to verify no line was
                                  // missed or misread — extract EXACTLY as printed
  "gst_amount": number,           // printed GST amount, 0 if not shown
  "invoice_total": number,        // printed grand total, 0 if not shown
  "parts": [
    {
      "part_name": string,        // verbatim description
      "part_number": string,      // verbatim; keep spaces and dashes
      "qty": number,
      "unit_cost": number,        // 0 if not printed (will be derived)
      "total_cost": number,
      "grade": "OEM Genuine" | "OES" | "Aftermarket" | "Used/Recon" | "Unknown",
                                  // "OEM Genuine" only if marked original/genuine;
                                  // "Aftermarket" if marked replacement/copy/(TW)/APM;
                                  // "Used/Recon" if used/recon/secondhand.
                                  // NEVER guess — default "Unknown". Grade is the
                                  // single largest legitimate price driver, so a
                                  // wrong grade is worse than no grade.
      "unit_basis": "each" | "pair" | "set"
                                  // "pair" if the line prices two sides together
                                  // (LH/RH, pair); "set" for kits; else "each"
    }
  ]
}

Rules:
- Extract EVERY part line, top to bottom, including lines continued on later pages.
- If a table is split across pages, stitch the pages into one parts array.
- EXCLUDE any line that is struck through, or marked returned / "take back" /
  "workshop take back" / refunded. Do not include labour, GST, sub-total,
  discount, or sundry rows as parts.
- If unit_cost is not printed, set it to 0 — do not guess; the app computes
  unit = total / qty.
- Read handwriting and faint fax copy as best you can; if a value is unreadable,
  use "" for text or 0 for numbers rather than inventing one.
- doc_type = "Repair Estimate" ONLY when the document is a repairer's estimate
  (shows labour lines and/or a list-price discount column). A plain parts
  supplier tax invoice is "Tax Invoice".
- make/model: fill only when printed or unambiguous from chassis or part-number
  prefix (e.g. MBA = Mercedes, T##### = Toyota, 8R/8K = Audi, HY = Hyundai);
  otherwise leave "".
- Return one object per document. Do not merge two invoices into one object.
```

**User message:** attach the invoice (PDF or image) plus:

```
Extract this supplier invoice as JSON per the schema. One object, parts array complete.
```

Then convert the JSON array to a spreadsheet (any of these):
- Paste the JSON to Claude and ask: *"Convert this to a CSV with columns Supplier, Bill No, Bill Date, Make, Model, Doc Type, Part Name, Part Number, Qty, Unit Cost, Total Cost — one row per part."*
- Or run each file through the app's **OCR invoices** button, which does the JSON step for you and stores the result directly.

---

## Option B — Direct spreadsheet table (good for a handful at a time)

```
You are an OCR engine for Singapore motor-parts supplier invoices. Read the
attached invoice and output a Markdown table with EXACTLY these columns, in this
order, one row per part line:

Supplier | Bill No | Bill Date | Make | Model | Doc Type | Part Name | Part Number | Qty | Unit Cost | Total Cost | Grade | Unit Basis | GST

Rules:
- Repeat the bill-level fields (Supplier, Bill No, Bill Date, Make, Model,
  Doc Type, GST) on every row of the same invoice.
- Extract every part line, including across page breaks. Exclude struck-through /
  returned lines, labour, GST, sub-totals, discounts and sundries.
- Keep Part Name and Part Number verbatim (preserve spaces and dashes).
- Leave Unit Cost blank if not printed; leave Make/Model blank if not shown.
- Doc Type is "Repair Estimate" only for repairer estimates (labour + discount
  columns), otherwise "Tax Invoice".
- Grade is "OEM Genuine" only if marked original/genuine; "Aftermarket" if marked
  replacement/copy/(TW)/APM; "Used/Recon" if used/recon/secondhand; otherwise
  "Unknown". NEVER guess a grade.
- Unit Basis is "pair" if the line prices two sides together (LH/RH, pair);
  "set" for kits; else "each".
- GST is "incl" if the line prices include GST, "excl" if GST is added after the
  subtotal, else "unknown".
- Output ONLY the table. No commentary.

> Note: this variant skips the printed parts-subtotal / invoice-total fields, so
> the app's totals-reconciliation gate cannot check the extraction. Prefer
> Option A (or the batch runner) for anything beyond a handful of bills.
```

Paste the resulting tables into one sheet (or save as CSV) and upload via **Bulk upload · Claude-OCR'd Excel**.

---

## Tips for the 200-invoice run

- **Batch, don't merge.** One document per OCR call keeps part lines from bleeding across invoices — the batch runner does this automatically, dedupes on supplier + bill number across runs, and a totals mismatch lands the bill in the review queue instead of the benchmark.
- **Trial first.** `--dry-run` shows the plan; `--limit 5` runs a five-invoice trial so the extraction quality is confirmed before committing the full folder (and, in batch mode, before paying for it).
- **Multi-page bills.** If a single invoice runs to many pages and the parts list is long, split it and OCR in chunks — output token limits can truncate very large tables (the runner's reconciliation gate will catch a truncated table as a totals mismatch). Stitch the chunks into one sheet before upload.
- **Verify a sample.** Eyeball ~5% of extracted rows against the source (the POC#1 accuracy check) — the per-invoice JSONs under `ocr_out/json/` make this quick. Handwriting and faint fax copy are where errors cluster.
- **Keep Part Number verbatim.** The app normalises it on ingest (strips spaces/dashes/brand filler). Don't pre-clean it yourself — that's the app's job and keeping the raw form preserves an audit trail.
- **Blank over guess.** A blank make/model or unit cost is recoverable; a wrong one silently corrupts the benchmark.
