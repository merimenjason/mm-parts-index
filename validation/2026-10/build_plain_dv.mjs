// Plain-language version of the price-range (data validation) worksheet.
// Reads PartsIndex_data_validation_<date>.xlsx plus the local OCR JSONs (to find each bill's scanned
// file); writes a NEW file and changes nothing else.
// Usage: node build_plain_dv.mjs [path to PartsIndex_data_validation_<date>.xlsx]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../.."); // this folder is validation/2026-10 inside the repo
const PDF_DIR = process.env.INVOICES_DIR || path.join(REPO, "invoices"); // source bills (PDF / images)
const JSON_DIR = path.join(process.env.OCR_OUT_DIR || path.join(REPO, "ocr_out"), "json");
const SRC = path.resolve(process.argv[2] || fs.readdirSync(HERE).filter((f) => /^PartsIndex_data_validation_\d{4}-\d{2}-\d{2}\.xlsx$/.test(f)).sort().map((f) => path.join(HERE, f)).pop());
const XLSX = createRequire(path.join(REPO, "package.json"))("xlsx");

const src = XLSX.readFile(SRC);
const G = XLSX.utils.sheet_to_json(src.Sheets.Clusters, { defval: "" });
const L = XLSX.utils.sheet_to_json(src.Sheets.Lines, { defval: "" });
const readme = XLSX.utils.sheet_to_json(src.Sheets.README, { header: 1, defval: "" });
const snapshot = (readme.find((r) => r[0] === "Snapshot id") || [])[1] || "";
const fetched = String((readme.find((r) => r[0] === "Fetched") || [])[1] || "").slice(0, 10);

// bill → scanned file, via the OCR run's per-invoice JSON (supplier + bill number)
const norm = (x) => String(x ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const fileOf = new Map();
for (const f of fs.existsSync(JSON_DIR) ? fs.readdirSync(JSON_DIR) : []) {
  try { const j = JSON.parse(fs.readFileSync(path.join(JSON_DIR, f), "utf8"));
    if (j._source_file && fs.existsSync(path.join(PDF_DIR, j._source_file))) fileOf.set(norm(j.supplier_name) + "|" + norm(j.bill_no), j._source_file); } catch {}
}
const NO_FILE = "No scanned copy on this computer (older bill, added from a spreadsheet)";
const billFile = (l) => fileOf.get(norm(l.Supplier) + "|" + norm(l["Bill no"])) || "";
const openLink = (file) => (file ? { text: "Open", hyperlink: "file://" + encodeURI(path.join(PDF_DIR, file)), tooltip: file } : "–");
const billNo = (v) => String(v).replace(/^(\d+)\.0+$/, "$1"); // 8122844.0 → 8122844 (spreadsheet import artefact)
const searchLink = (l) => { const q = [l["Part number (as billed)"] || l["Part name (as billed)"], l.Make !== "Unknown" ? l.Make : ""].join(" ").trim();
  return q ? { text: "Search", hyperlink: "https://www.google.com/search?q=" + encodeURIComponent(q), tooltip: q } : ""; };

const isControl = (g) => /^Control/.test(g["Why sampled"]);
const whyPlain = (w) => w.split("; ").map((x) =>
  /^Wide range/.test(x) ? "The dearest price is 5 times the cheapest or more"
  : /^High spread/.test(x) ? "Prices are scattered widely around the typical price"
  : /^Headlamp/.test(x) ? "Headlamp: the example raised in the meeting"
  : /^Control/.test(x) ? "Comparison group: prices fairly close together, so it should be the same part"
  : x).join("; ");
const times = (a, b) => (b ? Math.round((a / b) * 10) / 10 : "");

// ---------- styling ----------
const C = { ink: "FF1F2937", muted: "FF6B7280", head: "FF0F4C5C", headInk: "FFFFFFFF", you: "FFFFF4CC", soft: "FFF3F6F8", good: "FFE3F4E8", warn: "FFFDECEA", line: "FFD1D5DB" };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const border = { top: { style: "thin", color: { argb: C.line } }, bottom: { style: "thin", color: { argb: C.line } }, left: { style: "thin", color: { argb: C.line } }, right: { style: "thin", color: { argb: C.line } } };
const LINK = { color: { argb: "FF0563C1" }, underline: true };
function table(ws, headers, rows, { youCols = [], hidden = [], widths = {}, headerRow = 1 } = {}) {
  const hr = ws.getRow(headerRow);
  headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: C.headInk } };
    c.fill = fill(youCols.includes(i) ? "FFB45309" : C.head); c.alignment = { wrapText: true, vertical: "middle" }; c.border = border; });
  hr.height = 34;
  rows.forEach((r, ri) => { const row = ws.getRow(headerRow + 1 + ri);
    r.forEach((v, i) => { const c = row.getCell(i + 1); c.value = v; c.border = border; c.alignment = { wrapText: true, vertical: "top" };
      if (v && typeof v === "object" && v.hyperlink) c.font = LINK; if (youCols.includes(i)) c.fill = fill(C.you); }); });
  headers.forEach((h, i) => { const col = ws.getColumn(i + 1); col.width = widths[i] ?? Math.max(10, Math.min(h.length + 2, 22)); if (hidden.includes(i)) col.hidden = true; });
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: headers.length } };
}

const REASONS = [
  ["Same part, price just varies", "It really is the same part. The price difference is genuine (different supplier, date or deal)."],
  ["Smaller piece of the part", "A clip, bracket, cover or other small piece, grouped with the full part (e.g. a S$5 bumper clip next to a S$600 bumper)."],
  ["Same name, different car", "Same kind of part, but made for a different car model, so not interchangeable."],
  ["Different position (front/rear etc.)", "Front vs rear, upper vs lower, or inner vs outer."],
  ["Different quality (genuine/copy/used)", "Genuine maker's part vs a copy (aftermarket) or a used/reconditioned one."],
  ["Priced as a pair or set", "The line charges for two (left and right) or a kit, not one piece."],
  ["Reading mistake on our record", "Our record has the wrong part number or price compared with the bill itself."],
  ["Can't tell", "Not enough information on the bill or online to decide."],
];
const VERDICTS = ["Real price differences", "Different parts mixed together", "Some of both", "Can't tell"];
const listF = (arr) => [`"${arr.join(",")}"`];

const wb = new ExcelJS.Workbook();

// ---------- 1. Start here ----------
const s = wb.addWorksheet("1. Start here", { properties: { tabColor: { argb: "FF0F4C5C" } } });
s.getColumn(1).width = 4; s.getColumn(2).width = 40; s.getColumn(3).width = 24; s.getColumn(4).width = 72;
let r = 1;
const put = (text, o = {}) => { const c = s.getCell(r, 2); c.value = text; c.font = { size: o.size || 11, bold: !!o.bold, color: { argb: o.color || C.ink } };
  c.alignment = { wrapText: true, vertical: "top" }; s.mergeCells(r, 2, r, 4); if (o.h) s.getRow(r).height = o.h; r++; };
const randomGroups = G.filter((g) => !isControl(g)), controls = G.filter(isControl);
const linesIn = (gs) => L.filter((l) => gs.some((g) => g.Cluster === l.Cluster)).length;
const hl = G.find((g) => /head ?lamp/i.test(g["Benchmark label"]) && g["Max S$"] >= 3000) || G[1];
const withFile = L.filter((l) => billFile(l)).length;

put("Are the big price ranges real?", { size: 18, bold: true, h: 28 });
put("A check on why some parts show a very wide price range in the price reference", { color: C.muted }); r++;
put("What this is about", { size: 13, bold: true });
put("The price reference groups together lines from supplier bills that describe the same part, and reports the typical price for each group (the middle price, so one unusual bill does not move it much). Some groups have a very wide range. For example the Toyota headlamp group runs from S$" + hl["Min S$"] + " to S$" + hl["Max S$"] + ".", { h: 48 });
put("There are two possible explanations, and they lead to different fixes:", {});
put("•  The prices really do vary for the same part. The typical price is still fine to use.", { h: 18 });
put("•  The group has lumped different parts together because their names look alike (a small clip with a whole bumper, or a headlamp for one car with a headlamp for another). Then the typical price is misleading, and the way parts are grouped needs fixing.", { h: 34 }); r++;

put("What we checked", { size: 13, bold: true });
put(`${G.length} groups, ${L.length} bill lines in total:`, {});
put(`•  ${randomGroups.length} groups with the widest price ranges (${linesIn(randomGroups)} lines).`, {});
put(`•  ${controls.length} comparison groups whose prices are fairly close (${linesIn(controls)} lines). These should come back as "same part". If they don't, the checking is being too strict.`, { h: 32 });
put(`Of the ${L.length} lines, ${withFile} have the scanned bill on this computer (click Open). The other ${L.length - withFile} are older 2018 bills added from a spreadsheet, so only our typed-up record is available.`, { h: 32 }); r++;

put("What we already know", { size: 13, bold: true });
const facts = [
  ["When the part number is exactly the same", "Prices agree", "Across the whole reference, the same part number from different suppliers costs almost exactly the same (typical difference: none). So where we know it is the same part, prices are not wildly different."],
  ["The headlamp group", `${hl.Quotes} prices, ${hl["Distinct part nos"]} different part numbers`, "Almost every bill in it is for a different part number. That suggests different headlamps grouped together, not one headlamp at many prices. This file lets a person confirm it."],
  ["Comparing similar parts by car model", "Did not help", "Keeping only lines for the same car model halved the number of usable groups without narrowing the ranges."],
];
facts.forEach(([a, b, c]) => { const row = s.getRow(r);
  [a, b, c].forEach((v, i) => { const cell = row.getCell(i + 2); cell.value = v; cell.alignment = { wrapText: true, vertical: "top" }; cell.border = border;
    if (i === 0) cell.font = { bold: true }; if (i === 1) cell.fill = fill(C.soft); });
  row.height = 48; r++; });
r++;

put("What we need from you  (about 2 hours)", { size: 13, bold: true });
put(`Step 1.  Sheet "2. Check each line" (${L.length} lines). For each line, click Open to see the bill and Search to look up the part number online. Write what the part is and which car it fits, then pick a reason from the drop-down in the yellow column. Lines are listed cheapest first within each group.`, { h: 46 });
put(`Step 2.  Sheet "3. Price groups" (${G.length} groups). Once a group's lines are done, pick a verdict for the whole group.`, { h: 18 });
put(`Step 3.  Sheet "4. Results" fills itself in and gives the answer.`, { h: 18 });
put("Tip: judge each line against what most of the group is (e.g. a full headlamp), not against the price. Looking up prices online is optional: Singapore prices are hard to find online and overseas prices are not comparable.", { color: "FF9A3412", h: 34 }); r++;

put("What the reasons mean", { size: 13, bold: true });
REASONS.forEach(([a, b]) => { const row = s.getRow(r); row.getCell(2).value = a; row.getCell(2).font = { bold: true }; row.getCell(2).alignment = { vertical: "top", wrapText: true };
  row.getCell(3).value = b; s.mergeCells(r, 3, r, 4); row.getCell(3).alignment = { wrapText: true, vertical: "top" }; row.height = 30; r++; });
r++;
put("Words used in this file", { size: 13, bold: true });
[["Group", "Bill lines the price reference treats as the same part. Each group gets one typical price."],
 ["Typical price", "The middle price in the group: half the prices are below it, half above."],
 ["Part number", "The maker's code printed on the bill that identifies the exact part (for example 81130-0L011)."],
 ["× typical", "How a line's price compares with its group's typical price. 2.0 means twice the typical price, 0.5 means half."],
].forEach(([a, b]) => { const row = s.getRow(r); row.getCell(2).value = a; row.getCell(2).font = { bold: true }; row.getCell(2).alignment = { vertical: "top" };
  row.getCell(3).value = b; s.mergeCells(r, 3, r, 4); row.getCell(3).alignment = { wrapText: true, vertical: "top" }; row.height = 30; r++; });
r++;
put(`Files: made from ${path.basename(SRC)}. Scanned bills are in ${PDF_DIR}. Price reference snapshot ${snapshot}${fetched ? ", taken " + fetched : ""}.`, { color: C.muted, h: 30 });

// ---------- 2. Check each line ----------
const ln = wb.addWorksheet("2. Check each line", { properties: { tabColor: { argb: "FFB45309" } } });
const gOf = new Map(G.map((g) => [g.Cluster, g]));
table(ln, ["Group", "Group name", "Comparison group?", "Price on this bill (S$)", "× typical", "Description on the bill", "Part number on the bill", "Car make", "Car model", "Supplier", "Bill number", "Bill date", "Bill file name", "Open the bill", "Look it up",
  "WHAT IS THIS PART?", "WHICH CAR DOES IT FIT?", "REASON (pick from list)", "Price found online (S$, optional)", "Where you found it (link)", "Your notes"],
  L.map((l) => { const f = billFile(l); return [l.Cluster, l["Benchmark label"], isControl(gOf.get(l.Cluster)) ? "Yes" : "", l["Line S$"], l["× median"], l["Part name (as billed)"], l["Part number (as billed)"],
    l.Make, l.Model, l.Supplier, billNo(l["Bill no"]), l["Bill date"], f || NO_FILE, openLink(f), searchLink(l), "", "", "", "", "", ""]; }),
  { youCols: [15, 16, 17, 18, 19, 20], widths: { 0: 7, 1: 24, 2: 11, 3: 11, 4: 9, 5: 30, 6: 20, 7: 12, 8: 14, 9: 24, 10: 15, 11: 11, 12: 42, 13: 8, 14: 8, 15: 26, 16: 20, 17: 26, 18: 12, 19: 20, 20: 24 } });
L.forEach((l, i) => { const row = ln.getRow(i + 2);
  row.getCell(18).dataValidation = { type: "list", allowBlank: true, formulae: listF(REASONS.map((x) => x[0])) };
  const x = +l["× median"]; if (x >= 2 || (x && x <= 0.5)) row.getCell(5).fill = fill(C.warn);
  if (!billFile(l)) row.getCell(13).font = { color: { argb: C.muted }, italic: true };
  row.getCell(7).font = { name: "Consolas" }; });
// light band per group so groups are easy to tell apart
let band = false, prev = "";
L.forEach((l, i) => { if (l.Cluster !== prev) { band = !band; prev = l.Cluster; } if (band) [1, 2].forEach((c) => (ln.getRow(i + 2).getCell(c).fill = fill(C.soft))); });

// ---------- 3. Price groups ----------
const gs = wb.addWorksheet("3. Price groups", { properties: { tabColor: { argb: "FFB45309" } } });
const nL = L.length + 1;
const LR = (col) => `'2. Check each line'!$${col}$2:$${col}$${nL}`;
const doneF = (n) => `COUNTIFS(${LR("A")},A${n},${LR("R")},"<>")&" of "&COUNTIF(${LR("A")},A${n})`;
const sameF = (n) => `COUNTIFS(${LR("A")},A${n},${LR("R")},"${REASONS[0][0]}")`;
const billsIn = (g) => [...new Set(L.filter((l) => l.Cluster === g.Cluster).map((l) => billFile(l) || `${l.Supplier} ${billNo(l["Bill no"])} (no scan)`))];
table(gs, ["Group", "Group name", "Car make", "Why we picked it", "Number of prices", "Cheapest (S$)", "Typical price (S$)", "Dearest (S$)", "Dearest is … times the cheapest", "Different part numbers in the group", "Different suppliers", "Names used on the bills", "Bill files in this group",
  "Lines done", "Lines marked \"Same part, price just varies\"", "YOUR VERDICT (pick from list)", "Your notes"],
  G.map((g, i) => [g.Cluster, g["Benchmark label"], g.Make, whyPlain(g["Why sampled"]), g.Quotes, g["Min S$"], g["Median S$"], g["Max S$"], times(g["Max S$"], g["Min S$"]), g["Distinct part nos"], g.Suppliers,
    g["Part names in cluster"].split(" | ").join("\n"), billsIn(g).join("\n"), { formula: doneF(i + 2) }, { formula: sameF(i + 2) }, "", ""]),
  { youCols: [15, 16], widths: { 0: 7, 1: 26, 2: 13, 3: 30, 4: 9, 5: 10, 6: 10, 7: 10, 8: 12, 9: 12, 10: 10, 11: 34, 12: 50, 13: 10, 14: 14, 15: 26, 16: 28 } });
G.forEach((g, i) => { const row = gs.getRow(i + 2); row.getCell(16).dataValidation = { type: "list", allowBlank: true, formulae: listF(VERDICTS) };
  if (isControl(g)) row.getCell(4).fill = fill(C.good); if (+times(g["Max S$"], g["Min S$"]) >= 5) row.getCell(9).fill = fill(C.warn); });

// ---------- 4. Results ----------
const rs = wb.addWorksheet("4. Results", { properties: { tabColor: { argb: "FF15803D" } } });
rs.getColumn(1).width = 44; rs.getColumn(2).width = 14; rs.getColumn(3).width = 14; rs.getColumn(4).width = 14; rs.getColumn(5).width = 60;
const head = (row, vals) => { vals.forEach((v, i) => { const c = rs.getRow(row).getCell(i + 1); c.value = v; c.font = { bold: true, color: { argb: C.headInk } }; c.fill = fill(C.head); c.alignment = { wrapText: true }; c.border = border; }); rs.getRow(row).height = 30; };
const sec = (row, t) => { const c = rs.getRow(row).getCell(1); c.value = t; c.font = { bold: true, size: 13, color: { argb: C.head } }; rs.getRow(row).height = 24; };
const cell = (row, col, v, fmt) => { const c = rs.getRow(row).getCell(col); c.value = v; if (fmt) c.numFmt = fmt; c.border = border; c.alignment = { wrapText: true, vertical: "top" }; return c; };
let rr = 1;
sec(rr++, "Progress");
cell(rr, 1, "Lines with a reason picked"); cell(rr, 2, { formula: `COUNTA(${LR("R")})&" of ${L.length}"` }); rr++;
cell(rr, 1, "Groups with a verdict"); cell(rr, 2, { formula: `COUNTA('3. Price groups'!$P$2:$P$${G.length + 1})&" of ${G.length}"` }); rr += 2;
sec(rr++, "Why do the prices differ?  (one row per reason)");
head(rr++, ["Reason", "Wide-range groups", "Share", "Comparison groups", "What it means"]);
const firstReasonRow = rr;
const wideCount = (reason) => `COUNTIFS(${LR("C")},"",${LR("R")},"${reason}")`, ctrlCount = (reason) => `COUNTIFS(${LR("C")},"Yes",${LR("R")},"${reason}")`;
const wideDone = `COUNTIFS(${LR("C")},"",${LR("R")},"<>")`;
REASONS.forEach(([reason, means]) => { cell(rr, 1, reason).font = { bold: true }; cell(rr, 2, { formula: wideCount(reason) });
  cell(rr, 3, { formula: `IFERROR(B${rr}/${wideDone},"")` }, "0%"); cell(rr, 4, { formula: ctrlCount(reason) }); cell(rr, 5, means); rr++; });
cell(rr, 1, "Total answered").font = { bold: true }; cell(rr, 2, { formula: `SUM(B${firstReasonRow}:B${rr - 1})` }); cell(rr, 4, { formula: `SUM(D${firstReasonRow}:D${rr - 1})` }); rr += 2;
sec(rr++, "The answer");
const sameShare = `IFERROR(B${firstReasonRow}/${wideDone},0)`;
const mixShare = `IFERROR(SUM(B${firstReasonRow + 1}:B${firstReasonRow + 5})/${wideDone},0)`;
cell(rr, 1, "Lines that are genuinely the same part"); cell(rr, 2, { formula: sameShare }, "0%").fill = fill(C.good); cell(rr, 5, "Out of the lines answered in the wide-range groups."); rr++;
cell(rr, 1, "Lines that are a different part or for a different car"); cell(rr, 2, { formula: mixShare }, "0%").fill = fill(C.good); cell(rr, 5, "Smaller piece, different car, different position, different quality, or pair/set."); rr++;
cell(rr, 1, "Lines with a reading mistake on our record"); cell(rr, 2, { formula: `IFERROR(B${firstReasonRow + 6}/${wideDone},0)` }, "0%").fill = fill(C.good); cell(rr, 5, "These should be corrected in the reference whatever the conclusion."); rr++;
const ans = cell(rr, 1, "In plain words"); ans.font = { bold: true };
rs.mergeCells(rr, 2, rr, 5);
cell(rr, 2, { formula: `IF(COUNTA(${LR("R")})<${Math.ceil(L.length * 0.8)},"Finish most of sheet 2 first.",IF(${sameShare}>=0.7,"Mostly real price differences: the wide ranges reflect the market, and the typical price can be used as it is.",IF(${mixShare}>=0.5,"Mostly different parts grouped together: the typical price is misleading for these groups. Fix how parts are grouped (for example, group by exact part number) rather than changing the statistics.","A mix of both: some ranges are real, others come from different parts being grouped together. Review the groups one by one on sheet 3.")))` }).font = { bold: true };
rs.getRow(rr).height = 48; rr++;
cell(rr, 1, "Comparison groups check"); rs.mergeCells(rr, 2, rr, 5);
cell(rr, 2, { formula: `IF(D${firstReasonRow + REASONS.length}=0,"Not answered yet.",IF(D${firstReasonRow}/D${firstReasonRow + REASONS.length}>=0.7,"OK: the comparison groups mostly came back as the same part, as expected.","Warning: even the comparison groups came back mostly as different parts. Either the checking is too strict, or the grouping problem affects every group."))` });
rs.getRow(rr).height = 34;

// ---------- 5. Bills ----------
const bl = wb.addWorksheet("5. Bills");
const bills = [...new Map(L.map((l) => [l.Supplier + "|" + billNo(l["Bill no"]), l])).values()];
table(bl, ["Supplier", "Bill number", "Bill date", "Bill file name", "Open the bill", "Groups it appears in", "Lines in this check"],
  bills.map((l) => { const f = billFile(l), mine = L.filter((x) => x.Supplier === l.Supplier && billNo(x["Bill no"]) === billNo(l["Bill no"]));
    return [l.Supplier, billNo(l["Bill no"]), l["Bill date"], f || NO_FILE, openLink(f), [...new Set(mine.map((x) => x.Cluster))].join(", "), mine.length]; })
    .sort((a, b) => String(a[3]).localeCompare(String(b[3]))),
  { widths: { 0: 30, 1: 16, 2: 11, 3: 60, 4: 8, 5: 16, 6: 10 } });

wb.worksheets.forEach((ws, i) => { ws.pageSetup = { paperSize: 9, orientation: i === 0 || i === 3 ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }; });

const out = path.join(HERE, path.basename(SRC).replace(/^PartsIndex_data_validation_/, "Price_range_check_").replace(/\.xlsx$/, "_plain.xlsx"));
await wb.xlsx.writeFile(out);
console.log(JSON.stringify({ out, groups: G.length, lines: L.length, linesWithFile: withFile, bills: bills.length, billsWithFile: bills.filter(billFile).length }, null, 1));
