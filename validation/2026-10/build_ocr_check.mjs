// OCR-accuracy check worksheet. Read-only: fetches the LIVE reference, reads the local OCR JSONs
// and links each sampled bill to its source PDF. Optionally diffs against a second OCR read.
// Usage: node build_ocr_check.mjs [--second /path/to/ocr_out_second] [--random 30] [--targeted 15]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../.."); // this folder is validation/2026-10 inside the repo
const OCR_DIR = process.env.OCR_OUT_DIR || path.join(REPO, "ocr_out"); // tools/batch-ocr.mjs output
const PDF_DIR = process.env.INVOICES_DIR || path.join(REPO, "invoices"); // source bills (PDF / images)
const OUT = HERE;
const URL_ = "https://mm-parts-index.vercel.app/api/parts";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N_RANDOM = +arg("--random", 30), N_TARGET = +arg("--targeted", 15), SECOND = arg("--second", "");
const SEED = 20261015;

const P = await import(pathToFileURL(path.join(REPO, "src/pipeline.js")).href);
const XLSX = createRequire(path.join(REPO, "package.json"))("xlsx");

// seeded PRNG so the same data gives the same sample
let s = SEED; const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 2 ** 32 || rnd();
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- live data ----------
const res = await fetch(URL_); if (!res.ok) throw new Error(`GET ${URL_} → ${res.status}`);
const raw = await res.json(); const fetchedAt = new Date().toISOString(); const stamp = fetchedAt.slice(0, 10);
fs.writeFileSync(path.join(OUT, `live_parts_${stamp}.json`), JSON.stringify(raw));
const parts = (raw.parts || []).map(P.upgradePart);
const cfg = { mode: "fuzzy-name", threshold: 0.65, sameMake: true, sameModel: false, tokenWeight: 0.6, bridge: false, sepGrade: true, sepSide: false, minQuotes: 4, maxAgeYears: 0 };
const snap = P.snapshotId(parts.filter((p) => !p.review), cfg);
const clusters = P.buildClusters(parts, cfg);
const clusterOf = new Map(); clusters.forEach((c) => c.members.forEach((m) => clusterOf.set(m.id, c)));

const norm = (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const billKey = (sup, no) => norm(sup) + "|" + norm(no);

// ---------- local OCR JSONs → source PDF ----------
const readJsonDir = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => {
  try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); return Array.isArray(j.parts) ? j : null; } catch { return null; }
}).filter(Boolean);
const ocr = readJsonDir(path.join(OCR_DIR, "json"));
const ocrByBill = new Map(ocr.map((j) => [billKey(j.supplier_name, j.bill_no), j]));
const ocrBySource = new Map(ocr.map((j) => [j._source_file, j]));

// group live lines by bill
const bills = new Map();
parts.forEach((p) => { const k = billKey(p.supplier, p.bill_no); if (!bills.has(k)) bills.set(k, []); bills.get(k).push(p); });
const billInfo = [...bills.entries()].map(([k, lines]) => {
  const j = ocrByBill.get(k);
  const src = j?._source_file || "";
  const pdf = src && fs.existsSync(path.join(PDF_DIR, src)) ? path.join(PDF_DIR, src) : "";
  const m = src.match(/^(\d{4}-\d{2}-\d{2})-(.+)-([^-]+)-(\d+)\.[a-z]+$/i);
  return { k, lines, j, src, pdf, insurer: m ? m[2] : "", fileMake: m ? m[3] : "" };
});
const checkable = billInfo.filter((b) => b.pdf);

// ---------- free automated checks over ALL live lines ----------
const suspects = []; // { kind, bill k, line id, detail }
const flag = (kind, p, detail) => suspects.push({ kind, k: billKey(p.supplier, p.bill_no), id: p.id, p, detail });
const usable = parts.filter((p) => p.ltype === "Supplier Part");

// 1. part numbers one character apart (same make), both present
const byMake = {}; usable.filter((p) => p.npn && p.npn.length >= 6).forEach((p) => (byMake[p.make] ||= new Map()).set(p.npn, p));
// Characters OCR confuses. A one-digit difference in general is normal (LH/RH siblings are often
// adjacent catalogue numbers); a one-character difference between look-alikes is a likely misread.
const CONFUSABLE = new Set(["I1","L1","O0","D0","Q0","B8","S5","Z2","G6","BS","93","38","68","56","U0","EF"].flatMap((x) => [x, x[1] + x[0]]));
const oneOff = (a, b) => { if (a.length !== b.length) return false; let d = 0, pair = ""; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (++d > 1) return false; pair = a[i] + b[i]; } return d === 1 && CONFUSABLE.has(pair); };
const seenPair = new Set();
Object.values(byMake).forEach((mp) => { const arr = [...mp.values()]; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
  const a = arr[i], b = arr[j]; if (!oneOff(a.npn, b.npn)) continue;
  const key = [a.npn, b.npn].sort().join("~"); if (seenPair.has(key)) continue; seenPair.add(key);
  if (P.similarity(a.part_name, b.part_name) < 0.85) continue; // adjacent catalogue numbers (LH/RH, variants) are normal; only near-identical names suggest a misread
  const d = `${a.part_number} vs ${b.part_number} (${a.part_name} / ${b.part_name})`;
  flag("PN differs by one look-alike char", a, d); flag("PN differs by one look-alike char", b, d);
} });
// 2. letters I / O / Q sitting between digits
usable.forEach((p) => { if (/\d[IOQ]\d|\d[IOQ]$/.test(norm(p.part_number))) flag("I/O/Q among digits", p, p.part_number); });
// 3. price far from its cluster (clusters with 4+ quotes)
usable.forEach((p) => { const c = clusterOf.get(p.id); if (!c || c.n < 4 || !c.med) return;
  const r = p.unit / c.med; if (r >= 3 || r <= 1 / 3) flag("Price ≥3× off cluster median", p, `S$${p.unit} vs median S$${c.med} (${c.label})`); });
// 4. part number repeated in this bill under a different name (possible field bleed)
billInfo.forEach((b) => { const g = {}; b.lines.filter((p) => p.npn).forEach((p) => (g[p.npn] ||= []).push(p));
  Object.values(g).forEach((ls) => { if (new Set(ls.map((x) => norm(x.part_name))).size > 1) ls.forEach((p) => flag("Same PN, different names on one bill", p, ls.map((x) => x.part_name).join(" / "))); }); });
// 5. rows that are not parts (Run Log / error artefacts)
parts.forEach((p) => { if (/error|already extracted|unparseable|truncated|run log/i.test(p.part_number + " " + p.part_name)) flag("Not a part (artefact row)", p, (p.part_name + " " + p.part_number).slice(0, 80)); });
// 7. bill number stored as a float by Excel (e.g. 8049120.0) — import artefact, splits duplicate detection
billInfo.forEach((b) => { const no = String(b.lines[0].bill_no || ""); if (/^\d+\.0+$/.test(no)) flag("Bill no stored as Excel number", b.lines[0], no); });
// 6. extracted lines don't sum to the printed subtotal
billInfo.forEach((b) => { const j = b.j; if (!j || !j.parts_subtotal) return;
  const sum = j.parts.reduce((a, x) => a + (+x.total_cost || 0), 0);
  if (Math.abs(sum - j.parts_subtotal) > Math.max(1, j.parts_subtotal * 0.005)) b.lines.slice(0, 1).forEach((p) => flag("Lines ≠ printed subtotal", p, `sum S$${sum.toFixed(2)} vs printed S$${j.parts_subtotal}`)); });

const suspectsByBill = new Map(); suspects.forEach((x) => { if (!suspectsByBill.has(x.k)) suspectsByBill.set(x.k, new Set()); suspectsByBill.get(x.k).add(x.kind); });
const suspectLine = new Map(); suspects.forEach((x) => { if (!suspectLine.has(x.id)) suspectLine.set(x.id, []); suspectLine.get(x.id).push(x.kind); });

// ---------- sample ----------
// Random: stratified round-robin over make so no single make dominates.
const byMk = {}; shuffle(checkable).forEach((b) => (byMk[b.fileMake || b.lines[0].make] ||= []).push(b));
const randomPick = []; const queues = shuffle(Object.values(byMk));
while (randomPick.length < N_RANDOM && queues.some((q) => q.length)) for (const q of queues) { if (q.length && randomPick.length < N_RANDOM) randomPick.push(q.shift()); }
const randomSet = new Set(randomPick.map((b) => b.k));
// Targeted: most distinct suspect kinds first, then benchmark impact (lines in 4+ quote clusters).
const impact = (b) => b.lines.filter((p) => (clusterOf.get(p.id)?.n || 0) >= 4).length;
const targeted = checkable.filter((b) => !randomSet.has(b.k) && suspectsByBill.has(b.k))
  .sort((a, b) => suspectsByBill.get(b.k).size - suspectsByBill.get(a.k).size || impact(b) - impact(a)).slice(0, N_TARGET);
const sample = [...randomPick.map((b) => ({ ...b, type: "Random" })), ...targeted.map((b) => ({ ...b, type: "Targeted" }))];

// ---------- optional second read ----------
const second = SECOND ? readJsonDir(path.join(SECOND, "json")) : [];
const secondBySource = new Map(second.map((j) => [j._source_file, j]));
function secondFor(b, p) {
  const j = secondBySource.get(b.src); if (!j) return null;
  const xs = j.parts.map((x) => ({ ...x, npn: P.normPN(x.part_number), unit: +x.unit_cost || ((+x.total_cost || 0) / (+x.qty || 1)) }));
  let hit = p.npn && xs.find((x) => x.npn === p.npn);
  if (!hit) hit = xs.map((x) => ({ x, s: P.similarity(x.part_name, p.part_name) - Math.abs(x.unit - p.unit) / Math.max(p.unit, 1) }))
    .sort((a, b) => b.s - a.s)[0]?.x;
  return hit || null;
}

// ---------- workbook ----------
const wb = XLSX.utils.book_new();
const fileLink = (pth) => "file://" + encodeURI(pth);

// Bills sheet
const billRows = sample.map((b, i) => {
  const j = b.j; const sum = j ? j.parts.reduce((a, x) => a + (+x.total_cost || 0), 0) : 0;
  b.ref = "B" + String(i + 1).padStart(2, "0");
  return {
    "Bill": b.ref, "Sample": b.type, "Why targeted": b.type === "Targeted" ? [...suspectsByBill.get(b.k)].join("; ") : "",
    "Open PDF": "PDF", "Source file": b.src, "Insurer": b.insurer, "Make (file)": b.fileMake,
    "Supplier (extracted)": b.lines[0].supplier, "Bill no (extracted)": b.lines[0].bill_no, "Bill date (extracted)": b.lines[0].bill_date || "",
    "Lines in reference": b.lines.length, "Lines in OCR JSON": j ? j.parts.length : "",
    "Printed subtotal (extracted)": j?.parts_subtotal || "", "Sum of extracted lines": +sum.toFixed(2),
    "Supplier OK? (Y/N)": "", "Bill no OK? (Y/N)": "", "Date OK? (Y/N)": "", "Subtotal OK? (Y/N)": "",
    "MISSED lines (count)": "", "EXTRA lines (count)": "", "Notes": "",
  };
});
const wsB = XLSX.utils.json_to_sheet(billRows);
const bHead = Object.keys(billRows[0]); const pdfCol = bHead.indexOf("Open PDF");
sample.forEach((b, i) => { wsB[XLSX.utils.encode_cell({ r: i + 1, c: pdfCol })].l = { Target: fileLink(b.pdf), Tooltip: b.src }; });
wsB["!cols"] = bHead.map((h) => ({ wch: /Why|Source|Supplier \(|Notes/.test(h) ? 34 : Math.max(9, Math.min(h.length + 2, 22)) }));
wsB["!autofilter"] = { ref: wsB["!ref"] };

// Lines sheet. Blind entry columns come first; the extracted PN/price columns are hidden.
const lineRows = [];
sample.forEach((b) => b.lines.forEach((p, idx) => {
  const sec = SECOND ? secondFor(b, p) : null;
  lineRows.push({
    "Bill": b.ref, "Sample": b.type, "Line": idx + 1, "Open PDF": "PDF",
    "Part name (extracted)": p.part_name, "Qty (extracted)": p.qty, "Line total (extracted)": p.total,
    "TYPE part no from PDF": "", "TYPE unit price from PDF": "",
    "Name OK? (Y/N)": "", "Qty OK? (Y/N)": "", "Total OK? (Y/N)": "", "Belongs on this bill? (Y/N)": "",
    "PN check": "", "Price check": "", "Benchmark error?": "",
    "Notes": "",
    "Pre-flagged": (suspectLine.get(p.id) || []).join("; "),
    "In 4+ quote benchmark": (clusterOf.get(p.id)?.n || 0) >= 4 ? "yes" : "",
    "_PN extracted": p.part_number || "", "_Unit extracted": p.unit,
    "_PN 2nd reader": sec ? sec.part_number || "" : "", "_Unit 2nd reader": sec ? +(+sec.unit).toFixed(2) : "",
    "_2nd reader agrees": !SECOND ? "" : !sec ? "NO MATCH" : (P.normPN(sec.part_number) === p.npn && Math.abs(sec.unit - p.unit) < 0.01 ? "yes" : "NO"),
  });
}));
const wsL = XLSX.utils.json_to_sheet(lineRows);
const H = Object.keys(lineRows[0]); const col = (h) => XLSX.utils.encode_col(H.indexOf(h));
const C = { tpn: col("TYPE part no from PDF"), tpr: col("TYPE unit price from PDF"), xpn: col("_PN extracted"), xpr: col("_Unit extracted"),
  pnc: col("PN check"), prc: col("Price check"), be: col("Benchmark error?") };
const clean = (ref) => `UPPER(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${ref}," ",""),"-",""),".",""),"/",""))`;
lineRows.forEach((r, i) => {
  const n = i + 2;
  wsL[`${C.pnc}${n}`] = { t: "s", v: "", f: `IF(${C.tpn}${n}="","",IF(${clean(C.tpn + n)}=${clean(C.xpn + n)},"OK","DIFF"))` };
  wsL[`${C.prc}${n}`] = { t: "s", v: "", f: `IF(${C.tpr}${n}="","",IF(ABS(${C.tpr}${n}-${C.xpr}${n})<=0.01,"OK","DIFF"))` };
  wsL[`${C.be}${n}`] = { t: "s", v: "", f: `IF(OR(${C.pnc}${n}="DIFF",${C.prc}${n}="DIFF"),"YES",IF(AND(${C.pnc}${n}="OK",${C.prc}${n}="OK"),"NO",""))` };
  wsL[XLSX.utils.encode_cell({ r: n - 1, c: H.indexOf("Open PDF") })].l = { Target: fileLink(sample.find((b) => b.ref === r.Bill).pdf) };
});
wsL["!cols"] = H.map((h) => ({ wch: /Part name|Notes|Pre-flagged/.test(h) ? 32 : /TYPE/.test(h) ? 22 : Math.max(8, Math.min(h.length + 1, 16)), hidden: h.startsWith("_") }));
wsL["!autofilter"] = { ref: wsL["!ref"] };

// Summary (random sample only drives the headline rates)
const nL = lineRows.length + 1, nB = billRows.length + 1;
const Lr = (c) => `Lines!$${c}$2:$${c}$${nL}`; const Ls = Lr(col("Sample"));
const Bc = (h) => XLSX.utils.encode_col(bHead.indexOf(h)); const Br = (h) => `Bills!$${Bc(h)}$2:$${Bc(h)}$${nB}`; const Bs = Br("Sample");
const rate = (okR, badR, smp, okV = "OK", badV = "DIFF") =>
  `IFERROR(COUNTIFS(${smp},"Random",${okR},"${okV}")/(COUNTIFS(${smp},"Random",${okR},"${okV}")+COUNTIFS(${smp},"Random",${badR},"${badV}")),"")`;
const ynRate = (h) => rate(Lr(col(h)), Lr(col(h)), Ls, "Y", "N");
const ynBill = (h) => rate(Br(h), Br(h), Bs, "Y", "N");
const checked = `COUNTIFS(${Ls},"Random",${Lr(C.pnc)},"?*")`;
const summary = [
  ["OCR accuracy — RANDOM sample only (the targeted sample is excluded so it can't inflate the error rate)", "", ""],
  ["Measure", "Value", "How it's computed"],
  ["Lines checked (random)", { f: checked }, "Lines where a part number has been typed"],
  ["Part number accuracy", { f: rate(Lr(C.pnc), Lr(C.pnc), Ls), z: "0.0%" }, "Typed PN = extracted PN, ignoring spaces, dashes, dots and slashes"],
  ["Unit price accuracy", { f: rate(Lr(C.prc), Lr(C.prc), Ls), z: "0.0%" }, "Typed price within S$0.01 of extracted"],
  ["Lines with a benchmark-changing error", { f: `IFERROR(COUNTIFS(${Ls},"Random",${Lr(C.be)},"YES")/(COUNTIFS(${Ls},"Random",${Lr(C.be)},"YES")+COUNTIFS(${Ls},"Random",${Lr(C.be)},"NO")),"")`, z: "0.0%" }, "Wrong PN or wrong price — the headline figure"],
  ["Part name accuracy", { f: ynRate("Name OK? (Y/N)"), z: "0.0%" }, "Y / (Y+N)"],
  ["Qty accuracy", { f: ynRate("Qty OK? (Y/N)"), z: "0.0%" }, "Y / (Y+N)"],
  ["Line total accuracy", { f: ynRate("Total OK? (Y/N)"), z: "0.0%" }, "Y / (Y+N)"],
  ["Lines that belong to another row/bill", { f: `COUNTIFS(${Ls},"Random",${Lr(col("Belongs on this bill? (Y/N)"))},"N")` }, "Field bleed / wrong-row count"],
  ["Missed lines (random bills)", { f: `SUMIFS(${Br("MISSED lines (count)")},${Bs},"Random")` }, "Lines on the PDF the OCR did not extract"],
  ["Extra lines (random bills)", { f: `SUMIFS(${Br("EXTRA lines (count)")},${Bs},"Random")` }, "Extracted lines that aren't parts (labour, GST, duplicates)"],
  ["Supplier name accuracy", { f: ynBill("Supplier OK? (Y/N)"), z: "0.0%" }, "Per bill"],
  ["Bill no accuracy", { f: ynBill("Bill no OK? (Y/N)"), z: "0.0%" }, "Per bill"],
  ["Bill date accuracy", { f: ynBill("Date OK? (Y/N)"), z: "0.0%" }, "Per bill"],
  [],
  ["Targeted sample (for finding errors, not for rates)", "", ""],
  ["Benchmark-changing errors found", { f: `COUNTIFS(${Ls},"Targeted",${Lr(C.be)},"YES")` }, "Count only"],
];
const wsS = XLSX.utils.aoa_to_sheet(summary.map((r) => r.map((c) => (c && typeof c === "object" ? null : c))));
summary.forEach((r, i) => r.forEach((c, j) => { if (c && typeof c === "object") wsS[XLSX.utils.encode_cell({ r: i, c: j })] = { t: "n", v: 0, ...c }; }));
wsS["!cols"] = [{ wch: 42 }, { wch: 12 }, { wch: 70 }];

// Suspects sheet (whole reference)
const supRows = suspects.map((x) => ({
  "Check": x.kind, "Detail": x.detail, "Make": x.p.make, "Supplier": x.p.supplier, "Bill no": x.p.bill_no,
  "Part name": x.p.part_name, "Part number": x.p.part_number, "Unit S$": x.p.unit,
  "In sample as": sample.find((b) => b.k === x.k)?.ref || "",
  "Has PDF": billInfo.find((b) => b.k === x.k)?.pdf ? "yes" : "no",
}));
const wsX = XLSX.utils.json_to_sheet(supRows.length ? supRows : [{ Check: "none" }]);
wsX["!cols"] = [{ wch: 34 }, { wch: 60 }, { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 32 }, { wch: 22 }, { wch: 9 }, { wch: 12 }, { wch: 8 }];
wsX["!autofilter"] = { ref: wsX["!ref"] };

// README
const kinds = suspects.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {});
const readme = [
  ["PartsIndex — OCR accuracy check"], [],
  ["Question", "How often does the OCR put a wrong part number or price into the reference?"],
  ["Data source", URL_ + " (live, read-only) + local OCR JSONs " + OCR_DIR + " + PDFs in " + PDF_DIR],
  ["Fetched", fetchedAt], ["Snapshot id", snap],
  ["Reference", `${parts.length} lines · ${bills.size} bills · ${checkable.length} bills have a local PDF (only these can be sampled)`],
  ["Sample", `${randomPick.length} random bills + ${targeted.length} targeted bills · ${lineRows.length} lines · seed ${SEED}`],
  ["Second OCR read", SECOND ? `${second.length} invoices from ${SECOND} (hidden columns on Lines; see Second read sheet)` : "not loaded — re-run with --second <dir> once it exists"],
  [],
  ["How to check a bill"],
  ["1", "Bills sheet: click PDF to open the source document. Check supplier, bill no, date, printed subtotal (Y/N)."],
  ["2", "Lines sheet, same bill: find each line on the PDF using its name and line number."],
  ["3", "TYPE the part number and the unit price exactly as you read them on the PDF. Do not unhide the extracted columns first: seeing the answer makes you agree with it, and one-character misreads (I/1, B/S, 9/3) are exactly what we're measuring."],
  ["4", "Mark Name / Qty / Total / Belongs-on-this-bill as Y or N. 'N' on belongs = a value taken from another row (field bleed)."],
  ["5", "Back on Bills: count lines on the PDF that were missed, and extracted lines that aren't parts (EXTRA)."],
  ["6", "PN check, Price check and Benchmark error fill in automatically. The Summary sheet computes the rates."],
  [],
  ["Comparison rules", "Part numbers are compared ignoring spaces, dashes, dots and slashes (the app normalises those away, so they can't change a benchmark). Prices must match to S$0.01. If the PDF shows only a line total, type total ÷ qty."],
  ["Random vs targeted", "Only the RANDOM sample gives a rate you can quote. TARGETED bills were chosen because automated checks flagged them, so they will overstate errors; use them to find and explain error types."],
  ["Automated checks", Object.entries(kinds).map(([k, v]) => `${k}: ${v}`).join(" · ") + " (see Suspects sheet — whole reference)"],
];
const wsR = XLSX.utils.aoa_to_sheet(readme); wsR["!cols"] = [{ wch: 20 }, { wch: 130 }];

XLSX.utils.book_append_sheet(wb, wsR, "README");
XLSX.utils.book_append_sheet(wb, wsS, "Summary");
XLSX.utils.book_append_sheet(wb, wsB, "Bills");
XLSX.utils.book_append_sheet(wb, wsL, "Lines");
XLSX.utils.book_append_sheet(wb, wsX, "Suspects");

// Second-read disagreements over every bill that has both reads
if (SECOND) {
  const dis = [];
  billInfo.filter((b) => b.src && secondBySource.has(b.src)).forEach((b) => b.lines.forEach((p) => {
    const sec = secondFor(b, p);
    const agree = sec && P.normPN(sec.part_number) === p.npn && Math.abs(sec.unit - p.unit) < 0.01;
    if (!agree) dis.push({ "Source file": b.src, "Supplier": p.supplier, "Bill no": p.bill_no, "Part name": p.part_name,
      "PN (reference)": p.part_number, "PN (2nd read)": sec?.part_number ?? "NO MATCH", "Unit (reference)": p.unit,
      "Unit (2nd read)": sec ? +(+sec.unit).toFixed(2) : "", "In sample as": sample.find((x) => x.k === b.k)?.ref || "" });
  }));
  const wsD = XLSX.utils.json_to_sheet(dis.length ? dis : [{ "Source file": "no disagreements" }]);
  wsD["!autofilter"] = { ref: wsD["!ref"] };
  XLSX.utils.book_append_sheet(wb, wsD, "Second read");
}

const file = path.join(OUT, `PartsIndex_ocr_check_${stamp}.xlsx`);
XLSX.writeFile(wb, file, { cellStyles: true }); // cellStyles is required for hidden columns to be written
console.log(JSON.stringify({ file, snapshot: snap, liveBills: bills.size, ocrJsons: ocr.length, checkable: checkable.length,
  random: randomPick.length, targeted: targeted.length, lines: lineRows.length,
  randomMakes: [...new Set(randomPick.map((b) => b.fileMake))].length, suspects: kinds,
  suspectLinesInSample: lineRows.filter((r) => r["Pre-flagged"]).length, randomLines: lineRows.filter((r) => r.Sample === "Random").length }, null, 1));
