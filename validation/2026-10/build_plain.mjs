// Plain-language version of the OCR check, for reviewers who are not analysts.
// Reads the _opus55 workbook + verify_out/ answers; writes a NEW file and changes nothing else.
// Usage: node build_plain.mjs [path to ..._opus55.xlsx]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../.."); // this folder is validation/2026-10 inside the repo
const PDF_DIR = process.env.INVOICES_DIR || path.join(REPO, "invoices"); // source bills (PDF / images)
const SRC = path.resolve(process.argv[2] || fs.readdirSync(HERE).filter((f) => /_opus55\.xlsx$/.test(f)).sort().map((f) => path.join(HERE, f)).pop());
const XLSX = createRequire(path.join(REPO, "package.json"))("xlsx");

const src = XLSX.readFile(SRC);
const L = XLSX.utils.sheet_to_json(src.Sheets.Lines, { defval: "" });
const B = XLSX.utils.sheet_to_json(src.Sheets.Bills, { defval: "" });
const opus = new Map(fs.readdirSync(path.join(HERE, "verify_out")).map((f) => JSON.parse(fs.readFileSync(path.join(HERE, "verify_out", f), "utf8"))).map((j) => [j.bill, j]));
const billOf = new Map(B.map((b) => [b.Bill, b]));
const pdf = (b) => path.join(PDF_DIR, billOf.get(b)["Source file"]);
const link = (b) => ({ text: "Open", hyperlink: "file://" + encodeURI(pdf(b)), tooltip: billOf.get(b)["Source file"] });
const sampleWord = (s) => (s === "Random" ? "Random" : "Hand-picked");
const sure = (c) => ({ high: "Sure", medium: "Fairly sure", low: "Unsure" })[c] || "";
const money = (v) => (v === "" || v == null ? "" : Number(v));
const tokens = [...opus.values()].reduce((a, j) => [a[0] + (j.usage.input_tokens || 0) + (j.usage.cache_read_input_tokens || 0) + (j.usage.cache_creation_input_tokens || 0), a[1] + (j.usage.output_tokens || 0)], [0, 0]);
const cost = (tokens[0] * 4 + tokens[1] * 20) / 1e6;

// ---------- numbers ----------
const isRandom = (l) => l.Sample === "Random";
const st = (l) => l["Opus vs OCR"];
const rnd = L.filter(isRandom);
const agreeAll = L.filter((l) => st(l) === "AGREE").length, agreeRnd = rnd.filter((l) => st(l) === "AGREE").length;
const priceDiff = L.filter((l) => /PRICE/.test(st(l))).length;
const pnDiffAll = L.filter((l) => st(l) === "PN DIFFERS").length, pnDiffRnd = rnd.filter((l) => st(l) === "PN DIFFERS").length;
const notOnDoc = L.filter((l) => st(l) === "NOT ON DOC");
const notOnDocBills = [...new Set(notOnDoc.map((l) => l.Bill))];
const humanBills = B.filter((b) => b["HUMAN BLIND CHECK"]).map((b) => b.Bill);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "–");

// ---------- the "please check" list ----------
const checks = [];
for (const l of L) {
  const s = st(l), o = { pn: l["_Opus PN"], unit: l["_Opus unit"], conf: l["_Opus confidence"], note: l["_Opus note"] };
  const base = { bill: l.Bill, sample: l.Sample, item: `#${l.Line} ${l["Part name (extracted)"]}`, conf: sure(o.conf), note: o.note };
  if (s === "PN DIFFERS") checks.push({ ...base, kind: "line", what: "The two readings give a different part number. Look at the bill and choose which is right.", first: l["_PN extracted"], second: o.pn });
  else if (s === "PRICE DIFFERS" || s === "PN+PRICE DIFFER") checks.push({ ...base, kind: "line", what: "The two readings give a different part number and/or price. Look at the bill and choose which is right.", first: `${l["_PN extracted"]} · S$${l["_Unit extracted"]}`, second: `${o.pn} · S$${o.unit}` });
  else if (s === "NOT ON DOC") checks.push({ ...base, kind: "line", what: "The second reading could not find this item on the bill. Is it really on the bill?  First reading right = it is there.  Second reading right = it is not there.", first: `${l["_PN extracted"]} · S$${l["_Unit extracted"]}`, second: "(not found on the bill)" });
  else if (s === "AGREE" && o.conf === "low") checks.push({ ...base, kind: "line", what: "Both readings agree, but this part of the bill is hard to read. Please confirm the part number.", first: l["_PN extracted"], second: o.pn });
}
for (const b of B) {
  const j = opus.get(b.Bill); if (!j) continue;
  for (const m of j.result.missed_lines) checks.push({ bill: b.Bill, sample: b.Sample, kind: "missed", item: m.part_name, conf: "", note: "",
    what: "The second reading found an item the first reading did not record. Should it have been recorded?  Second reading right = yes, it was missed.  First reading right = no, it does not belong.",
    first: "(not recorded)", second: `${m.part_number}${m.line_total != null ? " · S$" + m.line_total : ""}` });
  if (String(b["Opus header differs"]).includes("bill no")) checks.push({ bill: b.Bill, sample: b.Sample, kind: "header", item: "Bill number", conf: "", note: "",
    what: "The two readings give a different bill number. Look at the bill and choose which is right.", first: String(b["Bill no (extracted)"]), second: j.result.bill_no });
  for (const h of String(b["Opus header differs"]).split(", ").filter((x) => x && x !== "bill no")) checks.push({ bill: b.Bill, sample: b.Sample, kind: "header", item: h, conf: "", note: "",
    what: `The two readings give a different ${h}. Look at the bill and choose which is right.`, first: h === "supplier" ? b["Supplier (extracted)"] : b["Printed subtotal (extracted)"], second: h === "supplier" ? j.result.supplier_name : j.result.parts_subtotal });
}
checks.sort((a, b) => a.bill.localeCompare(b.bill));

// ---------- styling helpers ----------
const C = { ink: "FF1F2937", muted: "FF6B7280", head: "FF0F4C5C", headInk: "FFFFFFFF", you: "FFFFF4CC", soft: "FFF3F6F8", good: "FFE3F4E8", warn: "FFFDECEA", line: "FFD1D5DB" };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const border = { top: { style: "thin", color: { argb: C.line } }, bottom: { style: "thin", color: { argb: C.line } }, left: { style: "thin", color: { argb: C.line } }, right: { style: "thin", color: { argb: C.line } } };
function table(ws, headers, rows, { youCols = [], hidden = [], widths = {}, headerRow = 1 } = {}) {
  const hr = ws.getRow(headerRow);
  headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: C.headInk } };
    c.fill = fill(youCols.includes(i) ? "FFB45309" : C.head); c.alignment = { wrapText: true, vertical: "middle" }; c.border = border; });
  hr.height = 34;
  rows.forEach((r, ri) => { const row = ws.getRow(headerRow + 1 + ri);
    r.forEach((v, i) => { const c = row.getCell(i + 1); c.value = v; c.border = border; c.alignment = { wrapText: true, vertical: "top" };
      if (youCols.includes(i)) c.fill = fill(C.you); });
  });
  headers.forEach((h, i) => { const col = ws.getColumn(i + 1); col.width = widths[i] ?? Math.max(10, Math.min(h.length + 2, 22)); if (hidden.includes(i)) col.hidden = true; });
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: headers.length } };
}
const cleanF = (ref) => `UPPER(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${ref}," ",""),"-",""),".",""),"/",""))`;

const wb = new ExcelJS.Workbook();
wb.creator = "PartsIndex OCR check";

// ---------- 1. Start here ----------
const s = wb.addWorksheet("1. Start here", { properties: { tabColor: { argb: "FF0F4C5C" } } });
s.getColumn(1).width = 4; s.getColumn(2).width = 46; s.getColumn(3).width = 22; s.getColumn(4).width = 70;
let r = 1;
const put = (text, opts = {}) => { const c = s.getCell(r, 2); c.value = text; c.font = { size: opts.size || 11, bold: !!opts.bold, color: { argb: opts.color || C.ink } };
  c.alignment = { wrapText: true, vertical: "top" }; if (opts.merge !== false) s.mergeCells(r, 2, r, 4); if (opts.h) s.getRow(r).height = opts.h; r++; };
put("Are the bills being read correctly?", { size: 18, bold: true, h: 28 });
put("A check on how accurately the computer read our supplier bills", { color: C.muted }); r++;
put("What this is about", { size: 13, bold: true });
put("We use a computer program (an AI) to read supplier bills and type up every part on them: the part number, the description and the price. Those typed-up lines feed the parts price reference. If the program misreads a part number or a price, the reference is wrong in a way nobody would notice.", { h: 62 });
put("To check it, we asked a second, newer AI to read the same bills again, without showing it what the first one wrote. Where the two readings agree, the line is very likely right. Where they disagree, a person needs to look at the bill and decide.", { h: 48 }); r++;
put("What we checked", { size: 13, bold: true });
put(`${B.length} bills, ${L.length} part lines in total:`, {});
put(`•  ${B.filter((b) => b.Sample === "Random").length} bills picked at random (${rnd.length} lines). These give a fair picture of how accurate the reading is overall.`, { h: 32 });
put(`•  ${B.filter((b) => b.Sample !== "Random").length} hand-picked bills (${L.length - rnd.length} lines) that automatic checks had flagged as suspicious. These are for finding problems, so they are kept out of the overall accuracy figure.`, { h: 32 }); r++;

put("What we found so far", { size: 13, bold: true });
const facts = [
  ["Lines where both readings agree", `${agreeRnd} of ${rnd.length} random lines (${pct(agreeRnd, rnd.length)})`, `${agreeAll} of ${L.length} across all bills (${pct(agreeAll, L.length)}).`],
  ["Prices", priceDiff ? `${priceDiff} lines differ` : "No differences", priceDiff ? "Some prices differ; see sheet 2." : "Both readings gave the same price on every line we could compare. This is the most important result: prices drive the benchmark."],
  ["Part numbers", `${pnDiffAll} lines differ`, `${pnDiffRnd} of them in the random bills. Often a single look-alike character (8 vs B, 1 vs I, 6 vs 0). These need a person to check (sheet 2).`],
  ["Items the second reading could not find", `${notOnDoc.length} lines`, notOnDocBills.length === 1 ? `All on bill ${notOnDocBills[0]}, a cropped screenshot. Some of its items may be cut off the image, and 3 look like the same item recorded twice.` : `On bills ${notOnDocBills.join(", ")}.`],
  ["Other things to check", `${checks.filter((c) => c.kind !== "line").length}`, "Bill numbers that differ, and items the first reading may have missed."],
  ["Cost of the second reading", `US$${cost.toFixed(2)}`, "One-off cost of re-reading all 45 bills."],
];
facts.forEach(([a, b, c]) => { const row = s.getRow(r);
  [a, b, c].forEach((v, i) => { const cell = row.getCell(i + 2); cell.value = v; cell.alignment = { wrapText: true, vertical: "top" }; cell.border = border;
    if (i === 0) cell.font = { bold: true }; if (i === 1) cell.fill = fill(C.soft); });
  row.height = 46; r++; });
r++;
put("Important: agreement is good news, but it is not proof. Both AIs are made by the same company and can occasionally make the same mistake on a blurry character. That is why a person checks a small part of the work too (step 2 below).", { color: "FF9A3412", h: 48 }); r++;

put("What we need from you  (about 45–60 minutes)", { size: 13, bold: true });
put(`Step 1.  Sheet "2. Please check these" (${checks.length} rows). For each row, click Open to see the bill, then pick an answer from the drop-down in the yellow column.`, { h: 32 });
put(`Step 2.  Sheet "3. Spot check" (${L.filter((l) => humanBills.includes(l.Bill)).length} lines on ${humanBills.length} bills). Type the part number and price you see on the bill. Do this before opening sheet 5, which shows the computers' answers.`, { h: 32 });
put(`Step 3.  Sheet "4. Results" fills itself in as you go. When steps 1 and 2 are done, it shows the final accuracy figures.`, { h: 32 }); r++;

put("Words used in this file", { size: 13, bold: true });
[["First reading", "What the original program typed up when the bills were first added. This is what is in the parts price reference today."],
 ["Second reading", "The new check: a newer AI (Claude Opus 5.5) reading the same bill again on its own."],
 ["Part number", "The manufacturer's code printed on the bill that identifies the exact part (for example 52119-06971)."],
 ["Line / item", "One row on a bill: one part, with its quantity and price."],
 ["Random / Hand-picked", "Random bills give a fair accuracy figure. Hand-picked bills were chosen because they looked suspicious, so they would make accuracy look worse than it is."],
 ["Spaces and dashes", "Ignored when comparing part numbers. 52119-06971 and 52119 06971 count as the same."],
].forEach(([a, b]) => { const row = s.getRow(r); row.getCell(2).value = a; row.getCell(2).font = { bold: true }; row.getCell(2).alignment = { vertical: "top" }; row.getCell(3).value = b; s.mergeCells(r, 3, r, 4);
  row.getCell(3).alignment = { wrapText: true, vertical: "top" }; row.height = 32; r++; });
r++;
put(`Source: ${path.basename(SRC)} · parts reference snapshot ${"PIX-335e1802-6b06668c"} · bills in ${PDF_DIR}`, { color: C.muted });

// ---------- 2. Please check these ----------
const q = wb.addWorksheet("2. Please check these", { properties: { tabColor: { argb: "FFB45309" } } });
const ANSWERS = ["First reading is right", "Second reading is right", "Both are wrong", "Can't tell"];
table(q, ["No.", "Bill", "Random or hand-picked", "Open the bill", "What to check", "Item", "First reading", "Second reading", "How sure the second reading was", "Second reading's comment", "YOUR ANSWER (pick from list)", "If both are wrong, what is correct?", "Your notes", "_kind"],
  checks.map((c, i) => [i + 1, c.bill, sampleWord(c.sample), link(c.bill), c.what, c.item, c.first, c.second, c.conf, c.note, "", "", "", c.kind]),
  { youCols: [10, 11, 12], hidden: [13], widths: { 0: 5, 1: 7, 2: 12, 3: 9, 4: 46, 5: 30, 6: 20, 7: 20, 8: 12, 9: 46, 10: 24, 11: 22, 12: 26 } });
checks.forEach((c, i) => { const row = q.getRow(i + 2); row.getCell(11).dataValidation = { type: "list", allowBlank: true, formulae: [`"${ANSWERS.join(",")}"`] };
  row.getCell(4).font = { color: { argb: "FF0563C1" }, underline: true }; row.getCell(7).font = { name: "Consolas" }; row.getCell(8).font = { name: "Consolas" };
  if (c.conf === "Unsure") row.getCell(9).fill = fill(C.warn); });

// ---------- 3. Spot check ----------
const sp = wb.addWorksheet("3. Spot check", { properties: { tabColor: { argb: "FFB45309" } } });
const spot = L.filter((l) => humanBills.includes(l.Bill));
sp.getCell("A1").value = "Type what you see on the bill. Please don't look at sheet 5 first: seeing the computers' answers makes it easy to agree with them by mistake.";
sp.getCell("A1").font = { bold: true, color: { argb: "FF9A3412" } }; sp.mergeCells("A1:L1"); sp.getRow(1).height = 22;
table(sp, ["Bill", "Item no.", "Description", "Qty", "Line total (S$)", "Open the bill", "TYPE the part number you see", "TYPE the unit price you see (S$)", "Matches second reading? (part no.)", "Matches second reading? (price)", "Matches first reading? (part no.)", "Matches first reading? (price)", "_2nd pn", "_2nd unit", "_1st pn", "_1st unit"],
  spot.map((l) => [l.Bill, l.Line, l["Part name (extracted)"], l["Qty (extracted)"], money(l["Line total (extracted)"]), link(l.Bill), "", "", "", "", "", "", l["_Opus PN"], money(l["_Opus unit"]), l["_PN extracted"], money(l["_Unit extracted"])]),
  { youCols: [6, 7], hidden: [12, 13, 14, 15], headerRow: 2, widths: { 0: 7, 1: 8, 2: 34, 3: 6, 4: 12, 5: 9, 6: 24, 7: 16, 8: 14, 9: 14, 10: 14, 11: 14 } });
spot.forEach((_, i) => { const n = i + 3, row = sp.getRow(n);
  const yes = (a, b, isPrice) => ({ formula: isPrice ? `IF(OR(${a}${n}="",${b}${n}=""),"",IF(ABS(${a}${n}-${b}${n})<=0.01,"Yes","No"))` : `IF(OR(${a}${n}="",${b}${n}=""),"",IF(${cleanF(a + n)}=${cleanF(b + n)},"Yes","No"))` });
  row.getCell(9).value = yes("G", "M", false); row.getCell(10).value = yes("H", "N", true);
  row.getCell(11).value = yes("G", "O", false); row.getCell(12).value = yes("H", "P", true);
  row.getCell(6).font = { color: { argb: "FF0563C1" }, underline: true }; });

// ---------- 4. Results ----------
const res = wb.addWorksheet("4. Results", { properties: { tabColor: { argb: "FF15803D" } } });
res.getColumn(1).width = 52; res.getColumn(2).width = 22; res.getColumn(3).width = 70;
const nQ = checks.length + 1, nS = spot.length + 2;
const QA = (col) => `'2. Please check these'!$${col}$2:$${col}$${nQ}`, SP = (col) => `'3. Spot check'!$${col}$3:$${col}$${nS}`;
const firstWrongRnd = `COUNTIFS(${QA("C")},"Random",${QA("N")},"line",${QA("K")},"${ANSWERS[1]}")+COUNTIFS(${QA("C")},"Random",${QA("N")},"line",${QA("K")},"${ANSWERS[2]}")`;
const rate = (col) => `IFERROR(COUNTIF(${SP(col)},"No")/(COUNTIF(${SP(col)},"Yes")+COUNTIF(${SP(col)},"No")),"")`;
const rows = [
  ["Progress", null, null, "section"],
  ["Rows answered on sheet 2", { formula: `COUNTA(${QA("K")})&" of ${checks.length}"` }, "Step 1"],
  ["Lines typed on sheet 3", { formula: `COUNTA(${SP("G")})&" of ${spot.length}"` }, "Step 2"],
  ["", null, null],
  ["The answer: how accurate is the first reading?", null, null, "section"],
  ["Mistakes found in the random bills", { formula: firstWrongRnd }, `Rows on sheet 2 from random bills where you answered "${ANSWERS[1]}" or "${ANSWERS[2]}".`],
  ["Lines read correctly (random bills)", { formula: `IFERROR(1-(${firstWrongRnd})/${rnd.length},"")`, numFmt: "0.0%" }, `Out of ${rnd.length} random lines. This is the main figure to report, once sheet 2 is finished.`],
  ["In plain words", { formula: `IF(COUNTA(${QA("K")})<${checks.length},"Finish sheet 2 first","About "&TEXT((${firstWrongRnd})/${rnd.length}*100,"0.0")&" mistakes in every 100 lines")` }, ""],
  ["Items the first reading missed", { formula: `COUNTIFS(${QA("N")},"missed",${QA("K")},"${ANSWERS[1]}")` }, "Items on a bill that never made it into the reference."],
  ["Bill numbers read wrongly", { formula: `COUNTIFS(${QA("N")},"header",${QA("K")},"${ANSWERS[1]}")+COUNTIFS(${QA("N")},"header",${QA("K")},"${ANSWERS[2]}")` }, ""],
  ["", null, null],
  ["Can we trust the second reading?  (from the spot check)", null, null, "section"],
  ["Second reading wrong on part number", { formula: rate("I"), numFmt: "0.0%" }, "How often what you typed differs from the second reading. Should be close to 0%."],
  ["Second reading wrong on price", { formula: rate("J"), numFmt: "0.0%" }, "Should be close to 0%."],
  ["First reading wrong on part number", { formula: rate("K"), numFmt: "0.0%" }, "A small direct check of the first reading, as a cross-check on the main figure."],
  ["First reading wrong on price", { formula: rate("L"), numFmt: "0.0%" }, ""],
  ["What it means", { formula: `IF(COUNTA(${SP("G")})=0,"Do the spot check first",IF(IFERROR(COUNTIF(${SP("I")},"No")/(COUNTIF(${SP("I")},"Yes")+COUNTIF(${SP("I")},"No")),0)<=0.03,"The second reading is reliable, so agreement between the two readings can be trusted.","The second reading also makes mistakes. Treat agreement with caution and check more lines by hand."))` }, ""],
];
rows.forEach(([a, b, c, kind], i) => { const row = res.getRow(i + 1);
  row.getCell(1).value = a; row.getCell(3).value = c || null; row.getCell(3).alignment = { wrapText: true, vertical: "top" }; row.getCell(1).alignment = { wrapText: true, vertical: "top" };
  if (kind === "section") { row.getCell(1).font = { bold: true, size: 13, color: { argb: C.head } }; row.height = 24; return; }
  if (b) { row.getCell(2).value = b.formula ? { formula: b.formula } : b; if (b.numFmt) row.getCell(2).numFmt = b.numFmt;
    row.getCell(2).fill = fill(C.good); row.getCell(2).font = { bold: true }; row.getCell(2).border = border; }
  if (a) row.height = 30; });

// ---------- 5. All lines ----------
const al = wb.addWorksheet("5. All lines");
al.getCell("A1").value = "Every line we checked, with both readings side by side. Please finish the spot check (sheet 3) before looking here.";
al.getCell("A1").font = { bold: true, color: { argb: "FF9A3412" } }; al.mergeCells("A1:J1");
const stWord = (x) => ({ "AGREE": "Same", "PN DIFFERS": "Part no. differs", "PRICE DIFFERS": "Price differs", "PN+PRICE DIFFER": "Both differ", "NOT ON DOC": "Not found on bill", "NOT RETURNED": "Not checked" })[x] || x;
table(al, ["Bill", "Random or hand-picked", "Item no.", "Description", "Part no. — first reading", "Part no. — second reading", "Price — first reading (S$)", "Price — second reading (S$)", "Result", "Open the bill"],
  L.map((l) => [l.Bill, sampleWord(l.Sample), l.Line, l["Part name (extracted)"], l["_PN extracted"], l["_Opus PN"], money(l["_Unit extracted"]), money(l["_Opus unit"]), stWord(st(l)), link(l.Bill)]),
  { headerRow: 2, widths: { 0: 7, 1: 12, 2: 8, 3: 34, 4: 20, 5: 20, 6: 13, 7: 13, 8: 16, 9: 9 } });
L.forEach((l, i) => { const row = al.getRow(i + 3); if (st(l) !== "AGREE") row.getCell(9).fill = fill(C.warn); else row.getCell(9).fill = fill(C.good);
  row.getCell(10).font = { color: { argb: "FF0563C1" }, underline: true }; });

// ---------- 6. Bills ----------
const bl = wb.addWorksheet("6. Bills");
table(bl, ["Bill", "Random or hand-picked", "Why it was hand-picked", "Insurer", "Car make", "Supplier", "Bill number", "Bill date", "Lines", "In the spot check?", "Open the bill"],
  B.map((b) => [b.Bill, sampleWord(b.Sample), String(b["Why targeted"]).replace(/PN differs by one look-alike char/g, "part number looks misread").replace(/Price ≥3× off cluster median/g, "price far from similar parts").replace(/Same PN, different names on one bill/g, "same part number used for different items").replace(/Bill no stored as Excel number/g, "bill number stored wrongly").replace(/Not a part \(artefact row\)/g, "contains a line that isn't a part").replace(/I\/O\/Q among digits/g, "letter mixed into a number").replace(/Lines ≠ printed subtotal/g, "lines don't add up to the bill total"),
    b.Insurer, b["Make (file)"], b["Supplier (extracted)"], String(b["Bill no (extracted)"]), b["Bill date (extracted)"], b["Lines in reference"], b["HUMAN BLIND CHECK"] ? "Yes" : "", link(b.Bill)]),
  { widths: { 0: 7, 1: 12, 2: 40, 3: 28, 4: 14, 5: 30, 6: 16, 7: 11, 8: 7, 9: 10, 10: 9 } });
B.forEach((b, i) => { bl.getRow(i + 2).getCell(11).font = { color: { argb: "FF0563C1" }, underline: true }; });

// Printing: fit every sheet to the page width; tables print landscape.
wb.worksheets.forEach((ws, i) => { ws.pageSetup = { paperSize: 9, orientation: i === 0 || i === 3 ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }; });
const out = path.join(HERE, path.basename(SRC).replace(/_opus55\.xlsx$/, "") + "_plain.xlsx").replace("PartsIndex_ocr_check_", "OCR_accuracy_check_");
await wb.xlsx.writeFile(out);
console.log(JSON.stringify({ out, checks: checks.length, byKind: checks.reduce((a, c) => ((a[c.kind] = (a[c.kind] || 0) + 1), a), {}), spotLines: spot.length, spotBills: humanBills, agreeRnd: `${agreeRnd}/${rnd.length}`, agreeAll: `${agreeAll}/${L.length}`, priceDiff, cost: cost.toFixed(2) }, null, 1));
