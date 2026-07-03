# OCR Extraction Prompt — Supplier Bills → PartsIndex Excel

Use this when handing the **200 supplier invoices** to Claude for OCR. It is tuned to produce output that maps **1:1** onto the columns PartsIndex expects, so the resulting spreadsheet imports with no manual cleanup.

There are two ways to run it. **Option A** (structured JSON, then convert to Excel) is the most reliable for bulk work and is what the app's built-in "OCR invoices" button uses. **Option B** asks Claude to emit a spreadsheet-ready table directly.

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
  "parts": [
    {
      "part_name": string,        // verbatim description
      "part_number": string,      // verbatim; keep spaces and dashes
      "qty": number,
      "unit_cost": number,        // 0 if not printed (will be derived)
      "total_cost": number
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

Supplier | Bill No | Bill Date | Make | Model | Doc Type | Part Name | Part Number | Qty | Unit Cost | Total Cost

Rules:
- Repeat the bill-level fields (Supplier, Bill No, Bill Date, Make, Model,
  Doc Type) on every row of the same invoice.
- Extract every part line, including across page breaks. Exclude struck-through /
  returned lines, labour, GST, sub-totals, discounts and sundries.
- Keep Part Name and Part Number verbatim (preserve spaces and dashes).
- Leave Unit Cost blank if not printed; leave Make/Model blank if not shown.
- Doc Type is "Repair Estimate" only for repairer estimates (labour + discount
  columns), otherwise "Tax Invoice".
- Output ONLY the table. No commentary.
```

Paste the resulting tables into one sheet (or save as CSV) and upload via **Bulk upload · Claude-OCR'd Excel**.

---

## Tips for the 200-invoice run

- **Batch, don't merge.** One document per OCR call keeps part lines from bleeding across invoices. The app dedupes on ingest, so re-running a file is safe.
- **Multi-page bills.** If a single invoice runs to many pages and the parts list is long, split it and OCR in chunks — output token limits can truncate very large tables. Stitch the chunks into one sheet before upload.
- **Verify a sample.** Eyeball ~5% of extracted rows against the source (the POC#1 accuracy check). Handwriting and faint fax copy are where errors cluster.
- **Keep Part Number verbatim.** The app normalises it on ingest (strips spaces/dashes/brand filler). Don't pre-clean it yourself — that's the app's job and keeping the raw form preserves an audit trail.
- **Blank over guess.** A blank make/model or unit cost is recoverable; a wrong one silently corrupts the benchmark.
