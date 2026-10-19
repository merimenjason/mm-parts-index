// Copies online_lookups_<date>.json into a copy of the plain price-range workbook.
// Fills: What is this part / Which car / Price found online / Where found / Notes, and adds a
// "Suggested reason" column. The reviewer's REASON column is left empty on purpose.
// Usage: node fill_lookups.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(HERE, "Price_range_check_2026-10-15_plain.xlsx");
const OUT = path.join(HERE, "Price_range_check_2026-10-15_plain_with_lookups.xlsx");
const LK = JSON.parse(fs.readFileSync(path.join(HERE, "online_lookups_2026-10-15.json"), "utf8"));
const parts = LK.parts;

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(IN);
const ws = wb.getWorksheet("2. Check each line");
const head = ws.getRow(1).values; // 1-based
const col = (name) => head.findIndex((h) => typeof h === "string" && h.startsWith(name));
const C = { group: col("Group"), pn: col("Part number on the bill"), price: col("Price on this bill"), what: col("WHAT IS THIS PART"), fits: col("WHICH CAR"),
  reason: col("REASON"), online: col("Price found online"), where: col("Where you found it"), notes: col("Your notes") };
if (Object.values(C).some((i) => i < 1)) throw new Error("Unexpected sheet layout: " + JSON.stringify(C));

// vehicle key: first model named in "fits", e.g. "toyota hiace", "mercedes-benz gla-class"
const vkey = (fits) => String(fits).toLowerCase().replace(/\(.*?\)/g, "").split(/[\/,;]| and | also /)[0].replace(/\s+/g, " ").trim();
const rows = [];
ws.eachRow((row, n) => { if (n > 1 && row.getCell(C.group).value) rows.push({ n, row, group: row.getCell(C.group).value, pn: String(row.getCell(C.pn).value ?? ""), price: +row.getCell(C.price).value }); });
const missing = rows.filter((r) => !parts[r.pn]);
if (missing.length) throw new Error("No lookup for: " + missing.map((r) => r.pn).join(", "));

// majority vehicle per group
const major = {};
for (const g of [...new Set(rows.map((r) => r.group))]) {
  const count = {}; rows.filter((r) => r.group === g).forEach((r) => { const k = vkey(parts[r.pn].fits); count[k] = (count[k] || 0) + 1; });
  major[g] = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

const SUG = ws.columnCount + 1;
const h = ws.getRow(1).getCell(SUG);
h.value = "SUGGESTED REASON (from the online look-up, please confirm)";
h.font = { bold: true, color: { argb: "FFFFFFFF" } }; h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C5C" } };
h.alignment = { wrapText: true, vertical: "middle" };
ws.getColumn(SUG).width = 30;

const counts = {};
for (const r of rows) {
  const p = parts[r.pn];
  const url = p.src === "amayama" ? `https://www.amayama.com/en/part/${p.brand}/${p.core}` : p.url;
  const suggestion = p.suggest || (vkey(p.fits) === major[r.group] ? "Same part, price just varies" : "Same name, different car");
  counts[suggestion] = (counts[suggestion] || 0) + 1;
  const vs = p.priceSGD && r.price ? ` The bill price is ${(r.price / p.priceSGD).toFixed(1)}× this online genuine-part price.` : "";
  const notes = `Looked up online by Claude, 15 Oct 2026 (${p.src === "amayama" ? "Amayama genuine-parts catalogue; price excludes shipping" : "web search, less certain"}). Please check.${p.note ? " " + p.note : ""}${vs}`;
  const set = (c, v) => { const cell = r.row.getCell(c); cell.value = v; cell.alignment = { wrapText: true, vertical: "top" }; return cell; };
  set(C.what, p.what);
  set(C.fits, p.fits);
  if (p.priceSGD) set(C.online, p.priceSGD).numFmt = "0.00";
  set(C.where, { text: p.src === "amayama" ? "Amayama" : new URL(url).hostname.replace(/^www\./, ""), hyperlink: url, tooltip: url }).font = { color: { argb: "FF0563C1" }, underline: true };
  set(C.notes, notes);
  const sc = set(SUG, suggestion);
  sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: suggestion.startsWith("Same part") ? "FFE3F4E8" : "FFFDECEA" } };
  sc.border = r.row.getCell(1).border;
}
ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: SUG } };

// a short note on the Start here sheet
const s = wb.getWorksheet("1. Start here");
let last = s.rowCount + 2;
const note = s.getCell(last, 2);
note.value = `Online look-ups done (15 Oct 2026): on sheet 2, "What is this part", "Which car", "Price found online" and "Where you found it" are already filled in from the Amayama parts catalogue (Toyota, Mercedes-Benz) and web searches (Tesla, Audi), with a suggested reason in the last column. Please check them against the bill and pick the final reason yourself in the yellow REASON column. Online prices are genuine parts shipped from Japan, so they are a rough guide only.`;
note.font = { bold: true, color: { argb: "FF15803D" } }; note.alignment = { wrapText: true, vertical: "top" };
s.mergeCells(last, 2, last, 4); s.getRow(last).height = 62;

await wb.xlsx.writeFile(OUT);
const byGroup = {};
for (const r of rows) { const p = parts[r.pn]; const sug = p.suggest || (vkey(p.fits) === major[r.group] ? "Same part, price just varies" : "Same name, different car"); (byGroup[r.group] ||= {})[sug] = (byGroup[r.group][sug] || 0) + 1; }
console.log(JSON.stringify({ out: OUT, lines: rows.length, suggestions: counts, byGroup, major }, null, 1));
