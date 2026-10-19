// Copies ocr_lookups_<date>.json into a copy of the plain OCR-check workbook (sheet 2).
// Adds "What the online look-up found", "Suggested answer" and "Source" columns. The reviewer's
// YOUR ANSWER column is left empty on purpose.
// Usage: node fill_ocr_lookups.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(HERE, "OCR_accuracy_check_2026-10-15_plain.xlsx");
const OUT = path.join(HERE, "OCR_accuracy_check_2026-10-15_plain_with_lookups.xlsx");
const LK = JSON.parse(fs.readFileSync(path.join(HERE, "ocr_lookups_2026-10-15.json"), "utf8")).rows;

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(IN);
const ws = wb.getWorksheet("2. Please check these");
const H = ws.getRow(1).values;
const col = (name) => H.findIndex((h) => typeof h === "string" && h.startsWith(name));
const C = { bill: col("Bill"), item: col("Item"), kind: col("_kind") };
if (Object.values(C).some((i) => i < 1)) throw new Error("Unexpected sheet layout");

const start = ws.columnCount + 1;
const heads = ["WHAT THE ONLINE LOOK-UP FOUND", "SUGGESTED ANSWER (please confirm)", "Correct value suggested", "Look-up source"];
heads.forEach((t, i) => { const c = ws.getRow(1).getCell(start + i); c.value = t; c.font = { bold: true, color: { argb: "FFFFFFFF" } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C5C" } }; c.alignment = { wrapText: true, vertical: "middle" }; });
[52, 24, 18, 12].forEach((w, i) => (ws.getColumn(start + i).width = w));

const used = new Set(); let filled = 0, none = 0;
ws.eachRow((row, n) => {
  if (n === 1) return;
  const bill = row.getCell(C.bill).value, kind = row.getCell(C.kind).value, item = String(row.getCell(C.item).value ?? "");
  const key = kind === "missed" ? `${bill}|missed` : `${bill}|${(item.match(/^#(\d+)/) || [])[1] || "header"}`;
  const f = LK[key];
  const set = (i, v) => { const c = row.getCell(start + i); c.value = v; c.alignment = { wrapText: true, vertical: "top" }; c.border = row.getCell(1).border; return c; };
  if (!f) {
    none++;
    set(0, kind === "header" ? "Not checked online: bill numbers are not in any parts catalogue." : "Not checked online: the question is whether the item is on the bill image, which a catalogue cannot answer.").font = { color: { argb: "FF6B7280" }, italic: true };
    return;
  }
  used.add(key); filled++;
  set(0, f.finding);
  const s = set(1, f.suggest);
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: f.suggest === "Can't tell" ? "FFF3F6F8" : "FFE3F4E8" } }; s.font = { bold: true };
  if (f.correct) set(2, f.correct).font = { name: "Consolas" };
  if (f.src) set(3, { text: new URL(f.src).hostname.replace(/^www\./, ""), hyperlink: f.src, tooltip: f.src }).font = { color: { argb: "FF0563C1" }, underline: true };
});
const unused = Object.keys(LK).filter((k) => !used.has(k));
if (unused.length) throw new Error("Look-ups not matched to a row: " + unused.join(", "));
ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: start + heads.length - 1 } };

const s = wb.getWorksheet("1. Start here");
const r = s.rowCount + 2;
const note = s.getCell(r, 2);
note.value = `Online look-ups done (15 Oct 2026): for each part-number disagreement on sheet 2, both readings were looked up in the maker's parts catalogue (Amayama for Kia, Mercedes-Benz, Honda and Toyota; web search for Tesla and Mazda). A real part number exists and matches the item; a misread usually does not. The finding and a suggested answer are in the last columns of sheet 2. Please still check the bill and pick the final answer yourself in the yellow column.`;
note.font = { bold: true, color: { argb: "FF15803D" } }; note.alignment = { wrapText: true, vertical: "top" };
s.mergeCells(r, 2, r, 4); s.getRow(r).height = 64;

await wb.xlsx.writeFile(OUT);
const tally = Object.values(LK).reduce((a, f) => ((a[f.suggest] = (a[f.suggest] || 0) + 1), a), {});
console.log(JSON.stringify({ out: OUT, rowsWithLookup: filled, rowsNotCheckable: none, suggestions: tally }, null, 1));
