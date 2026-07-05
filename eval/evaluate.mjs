/* Gold-set matcher evaluation — Step 2.
 *
 * Reads eval/gold_pairs.csv (after human labeling), replays the EXACT similarity
 * function the app uses on every labeled pair, and reports precision / recall / F1
 * across the full threshold range and a small token-weight grid.
 *
 *   precision = of the pairs the matcher would MERGE, how many are truly the same part
 *               (low precision → false merges → WRONG benchmark medians — the dangerous error)
 *   recall    = of the truly-same pairs, how many the matcher merges
 *               (low recall → split clusters → thinner medians — the safe-but-wasteful error)
 *
 * Usage:  node eval/evaluate.mjs [path/to/gold_pairs.csv]
 * Output: console report + eval/results.csv
 *
 * Reading the result: pick the highest threshold whose recall is still acceptable,
 * or simply the max-F1 row if false merges and false splits hurt equally. For a
 * dispute-defensible benchmark, weight precision over recall.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { similarity } from "../src/pipeline.js";

const here = dirname(fileURLToPath(import.meta.url));
const path = process.argv[2] || join(here, "gold_pairs.csv");

// minimal RFC-4180 CSV parser (fields may contain quoted commas)
function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); field = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCSV(readFileSync(path, "utf8"));
const header = rows[0];
const col = (name) => header.indexOf(name);
const iLabel = col("label"), iA = col("part_name_a"), iB = col("part_name_b");

const pairs = [];
let unlabeled = 0, skipped = 0;
for (const r of rows.slice(1)) {
  const lab = (r[iLabel] || "").trim().toLowerCase();
  if (!lab) { unlabeled++; continue; }
  if (lab.startsWith("?")) { skipped++; continue; }
  const y = lab.startsWith("y");
  pairs.push({ a: r[iA], b: r[iB], truth: y });
}
if (!pairs.length) {
  console.error(`No labeled pairs found in ${path}. Fill the "label" column with y / n first.`);
  process.exit(1);
}
const pos = pairs.filter((p) => p.truth).length;
console.log(`Scoring ${pairs.length} labeled pairs (${pos} same-part, ${pairs.length - pos} different) — ${unlabeled} unlabeled and ${skipped} "?" rows skipped\n`);

const THRESHOLDS = Array.from({ length: 12 }, (_, k) => +(0.40 + k * 0.05).toFixed(2));
const TOKEN_WEIGHTS = [0.4, 0.6, 0.8];

const results = [];
for (const tw of TOKEN_WEIGHTS) {
  const sims = pairs.map((p) => ({ sim: similarity(p.a, p.b, tw), truth: p.truth }));
  for (const th of THRESHOLDS) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const s of sims) {
      const pred = s.sim >= th;
      if (pred && s.truth) tp++; else if (pred && !s.truth) fp++;
      else if (!pred && s.truth) fn++; else tn++;
    }
    const P = tp + fp ? tp / (tp + fp) : 1, R = tp + fn ? tp / (tp + fn) : 0;
    const F1 = P + R ? (2 * P * R) / (P + R) : 0;
    results.push({ tokenWeight: tw, threshold: th, tp, fp, fn, tn, precision: P, recall: R, f1: F1 });
  }
}

// report the app-default token weight in full; other weights as best-F1 summary
const fmt = (x) => (x * 100).toFixed(1).padStart(5) + "%";
console.log("token weight 0.6 (app default):");
console.log("  thr   precision  recall     F1     TP   FP   FN");
for (const r of results.filter((r) => r.tokenWeight === 0.6)) {
  console.log(`  ${r.threshold.toFixed(2)}   ${fmt(r.precision)}    ${fmt(r.recall)}   ${fmt(r.f1)}   ${String(r.tp).padStart(3)}  ${String(r.fp).padStart(3)}  ${String(r.fn).padStart(3)}`);
}
const best = [...results].sort((a, b) => b.f1 - a.f1)[0];
const bestHiP = [...results].filter((r) => r.precision >= 0.95).sort((a, b) => b.recall - a.recall)[0];
console.log(`\nBest F1 overall: F1 ${fmt(best.f1)} at threshold ${best.threshold}, tokenWeight ${best.tokenWeight} (P ${fmt(best.precision)}, R ${fmt(best.recall)})`);
if (bestHiP) console.log(`Dispute-grade (precision ≥ 95%): threshold ${bestHiP.threshold}, tokenWeight ${bestHiP.tokenWeight} → recall ${fmt(bestHiP.recall)}`);
else console.log("No setting reaches 95% precision on this gold set — prefer hybrid/exact-PN matching or tighten the matcher before relying on name-only merges.");

const out = join(here, "results.csv");
writeFileSync(out, ["tokenWeight,threshold,tp,fp,fn,tn,precision,recall,f1",
  ...results.map((r) => [r.tokenWeight, r.threshold, r.tp, r.fp, r.fn, r.tn, r.precision.toFixed(4), r.recall.toFixed(4), r.f1.toFixed(4)].join(","))].join("\n") + "\n");
console.log(`\nFull grid written to ${out}`);
