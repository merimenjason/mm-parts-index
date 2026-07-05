/* Gold-set pair generator — Step 1 of validating the fuzzy matcher.
 *
 * Generates candidate part pairs from the dataset for human labeling.
 * Labeling a few hundred pairs turns the matcher's threshold sliders from
 * guesswork into evidenced defaults, and gives every future matcher change
 * a regression test.
 *
 * Usage:
 *   node eval/generate_pairs.mjs                 # uses the embedded 174-line demo set
 *   node eval/generate_pairs.mjs data/parts.json # or any JSON array of raw part rows
 *
 * Output: eval/gold_pairs.csv with one row per candidate pair.
 *   - Pairs sharing an identical normalised part number are pre-labeled "y (auto)"
 *     — same PN is ground truth for "same part", no human effort needed.
 *   - All other pairs have a blank `label` column: fill in y (same part) or
 *     n (different part). Ambiguous? Use "?" and it will be skipped in scoring.
 *   - Pairs are sorted by similarity DESCENDING so the borderline region
 *     (where the threshold actually decides) is labeled first.
 *
 * Only name-similar pairs within the SAME MAKE are emitted (mirroring the app's
 * default sameMake=true), plus a small random sample of low-similarity pairs so
 * recall at low thresholds is measurable.
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { enrichPart, similarity } from "../src/pipeline.js";
import { DEMO_18 } from "../src/demoData.js";

const here = dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2];
const raw = inputPath ? JSON.parse(readFileSync(inputPath, "utf8")) : DEMO_18;

const parts = raw.map(enrichPart).filter((p) => p.ltype === "Supplier Part");
console.log(`Loaded ${raw.length} raw lines → ${parts.length} usable supplier-part lines`);

const TOKEN_WEIGHT = 0.6;        // must mirror the app default
const CANDIDATE_FLOOR = 0.30;    // pairs below this are near-certain negatives; sample a few anyway
const LOW_SIM_SAMPLE = 40;       // random low-sim pairs to keep, for recall measurement
const MAX_PAIRS = 600;

const cand = [];
const lowSim = [];
for (let i = 0; i < parts.length; i++) {
  for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j];
    if (a.make !== b.make) continue;                       // mirror sameMake=true
    if (a.npn && a.npn === b.npn) {                        // ground-truth positive
      cand.push({ a, b, sim: similarity(a.part_name, b.part_name, TOKEN_WEIGHT), auto: true });
      continue;
    }
    const sim = similarity(a.part_name, b.part_name, TOKEN_WEIGHT);
    if (sim >= CANDIDATE_FLOOR) cand.push({ a, b, sim, auto: false });
    else lowSim.push({ a, b, sim, auto: false });
  }
}
// deterministic "random" sample of low-sim pairs (seeded by index) for reproducibility
const step = Math.max(1, Math.floor(lowSim.length / LOW_SIM_SAMPLE));
const sampled = lowSim.filter((_, k) => k % step === 0).slice(0, LOW_SIM_SAMPLE);

const all = [...cand, ...sampled].sort((x, y) => y.sim - x.sim).slice(0, MAX_PAIRS);

const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const rows = [["pair_id","similarity","label","part_name_a","part_number_a","supplier_a","unit_a","part_name_b","part_number_b","supplier_b","unit_b","make","category_a","category_b"].join(",")];
all.forEach((p, k) => {
  rows.push([
    k + 1, p.sim.toFixed(4), p.auto ? "y (auto)" : "",
    esc(p.a.part_name), esc(p.a.part_number), esc(p.a.supplier), p.a.unit,
    esc(p.b.part_name), esc(p.b.part_number), esc(p.b.supplier), p.b.unit,
    esc(p.a.make), esc(p.a.cat), esc(p.b.cat),
  ].join(","));
});

mkdirSync(here, { recursive: true });
const out = join(here, "gold_pairs.csv");
writeFileSync(out, rows.join("\n") + "\n");

const auto = all.filter((p) => p.auto).length;
console.log(`Wrote ${all.length} candidate pairs → ${out}`);
console.log(`  ${auto} pre-labeled "y (auto)" (identical part numbers — ground truth)`);
console.log(`  ${all.length - auto} need a human label: fill the "label" column with y / n (or ? to skip)`);
console.log(`\nThen score with:  npm run eval:score`);
