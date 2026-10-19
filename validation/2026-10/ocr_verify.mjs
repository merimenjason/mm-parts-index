// Opus 5.5 blind re-read of the sampled bills in the OCR-check workbook.
//
// For every sampled bill, sends the source PDF plus a numbered list of the lines (name, qty, line
// total — enough to find each line, NOT the extracted part number or price) and asks Opus 5.5 to
// read the part number and unit price itself. The script then compares its reading with the OCR.
// Writes a NEW workbook; the input workbook (and any human entries in it) is never modified.
//
// Usage:
//   node ocr_verify.mjs --dry-run                       # plan only, no API calls, no key needed
//   node ocr_verify.mjs                                 # read all sampled bills (3 at a time)
//   node ocr_verify.mjs --workbook <your filled copy>   # start from a copy someone has been filling in
//   options: --concurrency 3  --effort medium  --human-bills 5  --no-fallback  --limit N
//
// Credentials: ANTHROPIC_API_KEY (or an `ant auth login` profile), resolved by the SDK.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../.."); // this folder is validation/2026-10 inside the repo
const PDF_DIR = process.env.INVOICES_DIR || path.join(REPO, "invoices"); // source bills (PDF / images)
const OUT_DIR = path.join(HERE, "verify_out");
const MODEL = "claude-opus-5-5";
const PRICE_IN = 4, PRICE_OUT = 20; // US$/MTok list price for claude-opus-5-5 (verify on the pricing page)

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const DRY = flag("--dry-run"), FALLBACK = !flag("--no-fallback");
const CONC = +opt("--concurrency", 3), EFFORT = opt("--effort", "medium"), HUMAN_BILLS = +opt("--human-bills", 5);
const LIMIT = +opt("--limit", Infinity);
const latest = fs.readdirSync(HERE).filter((f) => /^PartsIndex_ocr_check_\d{4}-\d{2}-\d{2}\.xlsx$/.test(f)).sort().pop();
const WORKBOOK = path.resolve(opt("--workbook", latest ? path.join(HERE, latest) : ""));
if (!fs.existsSync(WORKBOOK)) { console.error("Workbook not found. Run build_ocr_check.mjs first or pass --workbook."); process.exit(1); }

const XLSX = createRequire(path.join(REPO, "package.json"))("xlsx");
const P = await import(pathToFileURL(path.join(REPO, "src/pipeline.js")).href);

// ---------- read the sample from the workbook ----------
const wb = XLSX.readFile(WORKBOOK, { cellStyles: true, cellFormula: true });
for (const s of ["Bills", "Lines"]) if (!wb.Sheets[s]) { console.error(`Workbook has no ${s} sheet.`); process.exit(1); }
const billsTbl = XLSX.utils.sheet_to_json(wb.Sheets.Bills, { defval: "" });
const linesTbl = XLSX.utils.sheet_to_json(wb.Sheets.Lines, { defval: "" });
const bills = billsTbl.map((b) => ({
  ref: b.Bill, sample: b.Sample, src: b["Source file"], pdf: path.join(PDF_DIR, b["Source file"]),
  supplier: String(b["Supplier (extracted)"]), billNo: String(b["Bill no (extracted)"]), date: String(b["Bill date (extracted)"]),
  subtotal: b["Printed subtotal (extracted)"],
  lines: linesTbl.filter((l) => l.Bill === b.Bill).map((l) => ({
    line: +l.Line, name: String(l["Part name (extracted)"]), qty: l["Qty (extracted)"], total: l["Line total (extracted)"],
    pn: String(l["_PN extracted"] ?? ""), unit: +l["_Unit extracted"],
  })),
})).slice(0, LIMIT);
const missing = bills.filter((b) => !fs.existsSync(b.pdf));
if (missing.length) { console.error("Missing PDFs:\n" + missing.map((b) => "  " + b.pdf).join("\n")); process.exit(1); }

// The human blind-check slice: a seeded pick of random-sample bills, so the same workbook always
// gets the same slice. A person checks these blind, which measures how often Opus 5.5 itself misreads.
let seed = 551; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const humanSlice = new Set(bills.filter((b) => b.sample === "Random").map((b) => [rnd(), b.ref]).sort((a, b) => a[0] - b[0]).slice(0, HUMAN_BILLS).map((x) => x[1]));

// ---------- request ----------
const SYSTEM = `You are checking the accuracy of an earlier OCR extraction of a Singapore motor-parts supplier invoice. You are given the source document and a numbered list of part lines that the earlier extraction found, identified only by description, quantity and line total. Read each one off the document yourself.

For each listed line:
- Locate it on the document using the description, quantity and line total. Lines may be in a different order, and descriptions may have been read slightly differently.
- part_number: copy it exactly as printed, character by character, keeping its spaces and dashes. Do not correct, complete, or normalise it. Use "" if the line has no part number.
- unit_price: the unit price printed on that line. If only a line total is printed, give total ÷ quantity. Use null if you cannot read it.
- found: false if no line on the document matches. That suggests the earlier extraction invented the line or took it from another document.
- confidence: "high" when every character is clearly legible, "medium" when one character is uncertain, "low" when you are guessing.
- note: anything a reviewer should know (e.g. "fax noise over last two digits", "value appears to belong to the row above"), else "".

Also report the header as printed (supplier name, bill number, bill date, parts subtotal before GST, null if not printed), and list any part lines on the document that are NOT in the given list (missed_lines). Labour, paint, GST, discount and subtotal rows are not part lines.

Accuracy matters more than completeness: when a character is genuinely illegible, say so through confidence and note rather than guessing silently.`;

const Result = z.object({
  supplier_name: z.string(), bill_no: z.string(), bill_date: z.string(), parts_subtotal: z.number().nullable(),
  lines: z.array(z.object({
    line: z.number().int(), found: z.boolean(), part_number: z.string(), unit_price: z.number().nullable(),
    confidence: z.enum(["high", "medium", "low"]), note: z.string(),
  })),
  missed_lines: z.array(z.object({ part_name: z.string(), part_number: z.string(), line_total: z.number().nullable() })),
});

function userText(b) {
  const list = b.lines.map((l) => `${l.line}. ${l.name} | qty ${l.qty} | line total ${l.total}`).join("\n");
  return `Lines found by the earlier extraction (${b.lines.length}):\n${list}\n\nReturn one entry in "lines" for each numbered line above, using its number.`;
}

const cachePath = (b) => path.join(OUT_DIR, b.src.replace(/[^\w.-]+/g, "_") + ".json");

if (DRY) {
  const n = bills.reduce((a, b) => a + b.lines.length, 0);
  const done = bills.filter((b) => fs.existsSync(cachePath(b))).length;
  console.log(`Workbook: ${WORKBOOK}\nModel: ${MODEL} · effort ${EFFORT} · fallback ${FALLBACK ? "on (default routing)" : "off"}`);
  console.log(`${bills.length} bills (${bills.filter((b) => b.sample === "Random").length} random, ${bills.filter((b) => b.sample === "Targeted").length} targeted), ${n} lines; ${done} already read (cached), ${bills.length - done} to send.`);
  console.log(`Human blind-check slice: ${[...humanSlice].join(", ")} (${bills.filter((b) => humanSlice.has(b.ref)).reduce((a, b) => a + b.lines.length, 0)} lines)`);
  console.log(`Rough cost: the first OCR run averaged ~3.8k input / 0.6k output tokens per bill; with thinking at effort ${EFFORT} expect more output. Actual usage is recorded per bill.`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const client = new Anthropic({ maxRetries: 4 });

async function readBill(b) {
  const cp = cachePath(b);
  if (fs.existsSync(cp)) return JSON.parse(fs.readFileSync(cp, "utf8"));
  const data = fs.readFileSync(b.pdf).toString("base64");
  const isPdf = /\.pdf$/i.test(b.src);
  const media = isPdf ? null : ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" })[path.extname(b.src).toLowerCase()];
  const docBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: media, data } };
  const params = {
    model: MODEL, max_tokens: 16000,
    // Thinking is always on for Opus 5.5 (adaptive); effort is the only depth control and defaults to
    // medium on this model, so it is set explicitly.
    output_config: { effort: EFFORT, format: zodOutputFormat(Result) },
    system: SYSTEM,
    messages: [{ role: "user", content: [docBlock, { type: "text", text: userText(b) }] }],
  };
  // Server-side refusal fallback: if Opus 5.5 declines, the API re-runs the request on a fallback
  // model in the same call. The model that actually answered is recorded (served_by) so a
  // fallback reading is visible in the workbook. --no-fallback turns this off.
  const res = FALLBACK
    ? await client.beta.messages.parse({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
    : await client.messages.parse(params);
  if (res.stop_reason === "refusal") throw new Error(`refused (${res.stop_details?.category ?? "no category"})`);
  if (res.stop_reason === "max_tokens") throw new Error("output truncated at max_tokens");
  if (!res.parsed_output) throw new Error("response did not match the schema");
  const out = { source_file: b.src, bill: b.ref, served_by: res.model, at: new Date().toISOString(), usage: res.usage, result: res.parsed_output };
  fs.writeFileSync(cp, JSON.stringify(out, null, 1));
  return out;
}

// simple worker pool
const results = new Map(), failures = [];
let next = 0;
async function worker() {
  while (next < bills.length) {
    const b = bills[next++];
    try {
      const r = await readBill(b);
      results.set(b.ref, r);
      console.log(`✓ ${b.ref} ${b.src}${r.served_by !== MODEL ? `  (served by ${r.served_by})` : ""}`);
    } catch (e) {
      const why = e instanceof Anthropic.AuthenticationError ? "authentication failed — check ANTHROPIC_API_KEY"
        : e instanceof Anthropic.RateLimitError ? "rate limited after retries — re-run later, finished bills are cached"
        : e instanceof Anthropic.BadRequestError ? `bad request: ${e.message}`
        : e instanceof Anthropic.APIError ? `API error ${e.status}: ${e.message}` : e.message;
      failures.push({ ref: b.ref, src: b.src, why });
      console.log(`✗ ${b.ref} ${b.src}: ${why}`);
      if (e instanceof Anthropic.AuthenticationError) process.exit(1);
    }
  }
}
// Send one bill on its own first: a credentials or request-shape problem then stops the run after
// one failure instead of 45, before any further spend.
{
  const first = bills.find((b) => !fs.existsSync(cachePath(b)));
  if (first) {
    try { results.set(first.ref, await readBill(first)); console.log(`✓ ${first.ref} ${first.src}`); }
    catch (e) {
      const status = e instanceof Anthropic.APIError ? e.status : undefined;
      const retryable = status === 429 || status === 529 || (status >= 500);
      console.error(`✗ First request failed, stopping before the rest: ${e.message}`);
      if (!retryable) process.exit(1);
      failures.push({ ref: first.ref, src: first.src, why: e.message });
    }
    next = 0; bills.splice(bills.indexOf(first), 1); bills.unshift(first); next = 1; // first already handled
  }
}
await Promise.all(Array.from({ length: Math.min(CONC, bills.length) }, worker));

// ---------- compare ----------
const clean = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const priceEq = (a, b) => a != null && b != null && Math.abs(+a - +b) <= 0.01;
const lineCmp = new Map(); // `${bill}|${line}` -> comparison
const queue = [];
let tokIn = 0, tokOut = 0;
for (const b of bills) {
  const r = results.get(b.ref); if (!r) continue;
  tokIn += (r.usage.input_tokens || 0) + (r.usage.cache_read_input_tokens || 0) + (r.usage.cache_creation_input_tokens || 0);
  tokOut += r.usage.output_tokens || 0;
  const byLine = new Map(r.result.lines.map((x) => [x.line, x]));
  for (const l of b.lines) {
    const o = byLine.get(l.line);
    const c = { o, pnAgree: o && o.found ? clean(o.part_number) === clean(l.pn) : null, priceAgree: o && o.found ? priceEq(o.unit_price, l.unit) : null };
    c.status = !o ? "NOT RETURNED" : !o.found ? "NOT ON DOC" : c.pnAgree && c.priceAgree ? "AGREE" : !c.pnAgree && !c.priceAgree ? "PN+PRICE DIFFER" : !c.pnAgree ? "PN DIFFERS" : "PRICE DIFFERS";
    lineCmp.set(`${b.ref}|${l.line}`, c);
    if (c.status !== "AGREE" || o.confidence === "low")
      queue.push({ b, l, issue: c.status === "AGREE" ? "Agree, but Opus confidence low" : c.status, o });
  }
  for (const m of r.result.missed_lines) queue.push({ b, l: null, issue: "POSSIBLE MISSED LINE", o: m });
  const hdr = [["supplier", clean(r.result.supplier_name) === clean(b.supplier) || P.similarity(r.result.supplier_name, b.supplier) >= 0.8], ["bill no", clean(r.result.bill_no) === clean(b.billNo.replace(/\.0+$/, ""))],
    ["subtotal", !b.subtotal || r.result.parts_subtotal == null || priceEq(r.result.parts_subtotal, b.subtotal)]];
  b.opus = r; b.hdrDiff = hdr.filter((h) => !h[1]).map((h) => h[0]);
  if (b.hdrDiff.length) queue.push({ b, l: null, issue: "HEADER DIFFERS: " + b.hdrDiff.join(", "), o: r.result });
}

// ---------- write the new workbook ----------
const fileLink = (p) => "file://" + encodeURI(p);
function addColumns(ws, cols) { // cols: [{ header, values: (rowIdx0) => v | {f}, hidden, wch }]
  const rng = XLSX.utils.decode_range(ws["!ref"]); const nRows = rng.e.r; let c = rng.e.c + 1;
  ws["!cols"] = ws["!cols"] || [];
  for (const col of cols) {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: "s", v: col.header };
    for (let r = 1; r <= nRows; r++) {
      const v = col.values(r - 1); if (v === undefined || v === "") continue;
      ws[XLSX.utils.encode_cell({ r, c })] = typeof v === "object" ? { t: "s", v: "", ...v } : { t: typeof v === "number" ? "n" : "s", v };
    }
    ws["!cols"][c] = { wch: col.wch || Math.max(10, col.header.length + 2), hidden: !!col.hidden };
    c++;
  }
  rng.e.c = c - 1; ws["!ref"] = XLSX.utils.encode_range(rng);
  if (ws["!autofilter"]) ws["!autofilter"] = { ref: ws["!ref"] };
}

// Bills: human slice flag + Opus header reading
const billByRef = new Map(bills.map((b) => [b.ref, b]));
addColumns(wb.Sheets.Bills, [
  { header: "HUMAN BLIND CHECK", values: (i) => humanSlice.has(billsTbl[i].Bill) ? "YES — type PN & price blind" : "", wch: 26 },
  { header: "Opus 5.5 read?", values: (i) => results.has(billsTbl[i].Bill) ? "yes" : (failures.find((f) => f.ref === billsTbl[i].Bill) ? "FAILED" : "") },
  { header: "Opus header differs", values: (i) => billByRef.get(billsTbl[i].Bill)?.hdrDiff?.join(", ") || "" , wch: 18 },
  { header: "Opus missed lines", values: (i) => results.get(billsTbl[i].Bill)?.result.missed_lines.length ?? "" },
  { header: "Opus served by", values: (i) => results.get(billsTbl[i].Bill)?.served_by || "", wch: 16 },
]);

// Lines: Opus values hidden (they would anchor a blind reviewer); human-vs-Opus checks visible.
const LH = Object.keys(linesTbl[0]);
const colOf = (h) => XLSX.utils.encode_col(LH.indexOf(h));
const startCol = XLSX.utils.decode_range(wb.Sheets.Lines["!ref"]).e.c + 1;
const opusPnCol = XLSX.utils.encode_col(startCol), opusUnitCol = XLSX.utils.encode_col(startCol + 1);
const cleanF = (ref) => `UPPER(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${ref}," ",""),"-",""),".",""),"/",""))`;
const cmp = (i) => lineCmp.get(`${linesTbl[i].Bill}|${linesTbl[i].Line}`);
addColumns(wb.Sheets.Lines, [
  { header: "_Opus PN", values: (i) => cmp(i)?.o?.found ? cmp(i).o.part_number : "", hidden: true },
  { header: "_Opus unit", values: (i) => cmp(i)?.o?.found && cmp(i).o.unit_price != null ? cmp(i).o.unit_price : "", hidden: true },
  { header: "_Opus confidence", values: (i) => cmp(i)?.o?.confidence || "", hidden: true },
  { header: "_Opus note", values: (i) => cmp(i)?.o?.note || "", hidden: true },
  { header: "Opus vs OCR", values: (i) => cmp(i)?.status || "", wch: 16 },
  { header: "Human vs Opus PN", values: (i) => { const n = i + 2, t = colOf("TYPE part no from PDF");
      return { f: `IF(OR(${t}${n}="",${opusPnCol}${n}=""),"",IF(${cleanF(t + n)}=${cleanF(opusPnCol + n)},"OK","DIFF"))` }; } },
  { header: "Human vs Opus price", values: (i) => { const n = i + 2, t = colOf("TYPE unit price from PDF");
      return { f: `IF(OR(${t}${n}="",${opusUnitCol}${n}=""),"",IF(ABS(${t}${n}-${opusUnitCol}${n})<=0.01,"OK","DIFF"))` }; } },
]);

// Review queue
const qRows = queue.map((q) => ({
  "Bill": q.b.ref, "Sample": q.b.sample, "Human slice": humanSlice.has(q.b.ref) ? "yes" : "", "Line": q.l ? q.l.line : "", "Open PDF": "PDF",
  "Issue": q.issue, "Part name (OCR)": q.l ? q.l.name : (q.o.part_name || ""),
  "PN — OCR": q.l ? q.l.pn : "", "PN — Opus 5.5": q.l ? (q.o?.found ? q.o.part_number : "") : (q.o.part_number || ""),
  "Unit — OCR": q.l ? q.l.unit : "", "Unit — Opus 5.5": q.l ? (q.o?.found ? q.o.unit_price ?? "" : "") : (q.o.line_total ?? ""),
  "Opus confidence": q.l ? q.o?.confidence || "" : "", "Opus note": q.l ? q.o?.note || "" : "",
  "VERDICT (OCR / OPUS / NEITHER / NOT AN ERROR)": "", "Correct value if NEITHER": "", "Notes": "",
}));
const wsQ = XLSX.utils.json_to_sheet(qRows.length ? qRows : [{ Bill: "No disagreements" }]);
if (qRows.length) {
  const qh = Object.keys(qRows[0]); const pc = qh.indexOf("Open PDF");
  queue.forEach((q, i) => { wsQ[XLSX.utils.encode_cell({ r: i + 1, c: pc })].l = { Target: fileLink(q.b.pdf), Tooltip: q.b.src }; });
  wsQ["!cols"] = qh.map((h) => ({ wch: /Part name|note|Notes|Issue/.test(h) ? 30 : /VERDICT/.test(h) ? 22 : Math.max(9, Math.min(h.length + 2, 16)) }));
  wsQ["!autofilter"] = { ref: wsQ["!ref"] };
}

// Summary
const rnd_ = [...lineCmp.entries()].filter(([k]) => billByRef.get(k.split("|")[0]).sample === "Random").map(([, v]) => v);
const all_ = [...lineCmp.values()];
const cnt = (arr, s) => arr.filter((x) => x.status === s).length;
const qN = qRows.length + 1;
const qCol = (h) => XLSX.utils.encode_col(Object.keys(qRows[0] || { a: 1 }).indexOf(h));
const qR = (h) => `'Review queue'!$${qCol(h)}$2:$${qCol(h)}$${qN}`;
const linesN = linesTbl.length + 1;
const lR = (h) => `Lines!$${h}$2:$${h}$${linesN}`;
const hvoPn = XLSX.utils.encode_col(startCol + 5), hvoPr = XLSX.utils.encode_col(startCol + 6);
const confirmedOcrErr = qRows.length
  ? `COUNTIFS(${qR("Sample")},"Random",${qR("Line")},"<>",${qR("VERDICT (OCR / OPUS / NEITHER / NOT AN ERROR)")},"OPUS")+COUNTIFS(${qR("Sample")},"Random",${qR("Line")},"<>",${qR("VERDICT (OCR / OPUS / NEITHER / NOT AN ERROR)")},"NEITHER")`
  : "0";
const S = [
  ["Opus 5.5 verification — summary"], [],
  ["Model", MODEL + (FALLBACK ? " (server-side refusal fallback on)" : ""), ""],
  ["Effort", EFFORT, ""],
  ["Bills read / sampled", `${results.size} / ${bills.length}` + (failures.length ? ` — ${failures.length} failed: ${failures.map((f) => f.ref).join(", ")}` : ""), ""],
  ["Answered by a fallback model", [...results.values()].filter((r) => r.served_by !== MODEL).length, "Should be 0; if not, those bills were read by another model"],
  ["Tokens (in / out)", `${tokIn.toLocaleString()} / ${tokOut.toLocaleString()}`, `≈ US$${((tokIn * PRICE_IN + tokOut * PRICE_OUT) / 1e6).toFixed(2)} at $${PRICE_IN}/$${PRICE_OUT} per MTok list price`],
  [],
  ["AGREEMENT (no human input needed)", "Random", "All"],
  ["Lines compared", rnd_.length, all_.length],
  ["Opus agrees with OCR (PN and price)", rnd_.length ? +(cnt(rnd_, "AGREE") / rnd_.length).toFixed(4) : "", all_.length ? +(cnt(all_, "AGREE") / all_.length).toFixed(4) : ""],
  ["  PN differs", cnt(rnd_, "PN DIFFERS"), cnt(all_, "PN DIFFERS")],
  ["  Price differs", cnt(rnd_, "PRICE DIFFERS"), cnt(all_, "PRICE DIFFERS")],
  ["  Both differ", cnt(rnd_, "PN+PRICE DIFFER"), cnt(all_, "PN+PRICE DIFFER")],
  ["  Line not on the document", cnt(rnd_, "NOT ON DOC"), cnt(all_, "NOT ON DOC")],
  ["Possible missed lines", queue.filter((q) => q.issue === "POSSIBLE MISSED LINE" && q.b.sample === "Random").length, queue.filter((q) => q.issue === "POSSIBLE MISSED LINE").length],
  ["Agreement is a ceiling on accuracy: Opus 5 (first read) and Opus 5.5 can misread the same character the same way.", "", ""],
  [],
  ["AFTER HUMAN REVIEW", "Value", "How"],
  ["OCR errors confirmed (random lines)", { f: confirmedOcrErr }, "Review queue rows with verdict OPUS or NEITHER"],
  ["Estimated OCR line error rate (random)", { f: `IFERROR((${confirmedOcrErr})/${rnd_.length || 1},"")`, z: "0.0%" }, "Confirmed errors ÷ random lines compared — the figure to quote, once the queue is reviewed"],
  ["Opus 5.5 own PN error rate (human slice)", { f: `IFERROR(COUNTIF(${lR(hvoPn)},"DIFF")/(COUNTIF(${lR(hvoPn)},"OK")+COUNTIF(${lR(hvoPn)},"DIFF")),"")`, z: "0.0%" }, "From the blind human check of the bills marked HUMAN BLIND CHECK"],
  ["Opus 5.5 own price error rate (human slice)", { f: `IFERROR(COUNTIF(${lR(hvoPr)},"DIFF")/(COUNTIF(${lR(hvoPr)},"OK")+COUNTIF(${lR(hvoPr)},"DIFF")),"")`, z: "0.0%" }, "If these are not near zero, agreement alone cannot be trusted and the queue review matters more"],
  ["Review queue rows still to judge", qRows.length ? { f: `COUNTBLANK(${qR("VERDICT (OCR / OPUS / NEITHER / NOT AN ERROR)")})` } : 0, ""],
];
const wsS = XLSX.utils.aoa_to_sheet(S.map((r) => r.map((c) => (c && typeof c === "object" ? null : c))));
S.forEach((r, i) => r.forEach((c, j) => { if (c && typeof c === "object") wsS[XLSX.utils.encode_cell({ r: i, c: j })] = { t: "n", v: 0, ...c }; }));
[10].forEach((r) => ["B", "C"].forEach((c) => { const cell = wsS[`${c}${r + 1}`]; if (cell && cell.t === "n") cell.z = "0.0%"; }));
wsS["!cols"] = [{ wch: 44 }, { wch: 30 }, { wch: 80 }];

for (const [name, ws] of [["Opus summary", wsS], ["Review queue", wsQ]]) {
  if (wb.SheetNames.includes(name)) { delete wb.Sheets[name]; wb.SheetNames.splice(wb.SheetNames.indexOf(name), 1); }
  XLSX.utils.book_append_sheet(wb, ws, name);
}
// put the two new sheets right after README
for (const name of ["Review queue", "Opus summary"]) { wb.SheetNames.splice(wb.SheetNames.indexOf(name), 1); wb.SheetNames.splice(1, 0, name); }

if (!results.size) { console.error("No bills were read — workbook not written."); process.exit(1); }
const outFile = WORKBOOK.replace(/\.xlsx$/, "") + "_opus55.xlsx";
XLSX.writeFile(wb, outFile, { cellStyles: true });
console.log(`\n${results.size}/${bills.length} bills read · ${cnt(all_, "AGREE")}/${all_.length} lines agree · ${queue.length} rows in the review queue`);
console.log(`Tokens in/out: ${tokIn} / ${tokOut} (≈ US$${((tokIn * PRICE_IN + tokOut * PRICE_OUT) / 1e6).toFixed(2)})`);
if (failures.length) console.log(`Failed (re-run to retry; finished bills are cached): ${failures.map((f) => f.ref).join(", ")}`);
console.log(`Wrote ${outFile}`);
