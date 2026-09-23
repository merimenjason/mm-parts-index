/* Gold-set pair generator — Step 1 of validating the fuzzy matcher.
 *
 * Generates candidate part pairs for human labeling. The labels turn the
 * matcher's threshold from guesswork into an evidenced default, and give every
 * future matcher change a regression test.
 *
 * Usage:
 *   node eval/generate_pairs.mjs                          # the embedded 174-line demo set
 *   node eval/generate_pairs.mjs data/parts.json          # a JSON array of rows, or { parts: [...] }
 *   node eval/generate_pairs.mjs https://<app>/api/parts  # the live shared reference (GET is open)
 *
 * Output: eval/gold_pairs.csv, one row per pair. Fill `label` with y / n (? to skip).
 *
 * How pairs are chosen (v1.17.4 rewrite — the old version kept the top 600 pairs by
 * similarity, which on live data is almost entirely easy near-identical pairs):
 *   - Lines are prepared exactly as the app loads them (upgradePart on stored rows,
 *     enrichPart on raw ones) and filtered to what the benchmark uses: Supplier Part,
 *     not held for review.
 *   - Duplicate lines (same make, normalised name, part number, grade and basis —
 *     one part quoted on many bills) collapse to one, so a common part cannot
 *     fill the sample with 45 copies of the same comparison.
 *   - Only pairs the app COULD merge are emitted: same make, no grade conflict,
 *     same unit basis, no positional veto (default cfg). Labeling a pair the
 *     guards already block tells us nothing about the threshold.
 *   - Pairs are sampled per similarity band (BANDS below): dense around the 0.65
 *     threshold where the decision is genuinely made, a solid sample of identical-
 *     name / different-number pairs (similarity ≈ 1, merged regardless of number
 *     in fuzzy-name mode — the likeliest false merges), sparse at the low end.
 *   - No line appears in more than MAX_PER_LINE sampled pairs.
 *   - Each sampled pair carries a `weight` = candidates in its band ÷ pairs sampled
 *     from it. The sample deliberately over-represents the threshold region, so
 *     evaluate.mjs weights by this to report precision / recall for the whole
 *     population rather than for the sample.
 *   - Pairs sharing a normalised part number are appended as "y (auto)" — free
 *     ground truth, no human effort. evaluate.mjs --human-only scores without them.
 *   - Human rows are shuffled (seeded, reproducible) so the labeler is not anchored
 *     by a similarity ordering; the similarity column is last for the same reason.
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { enrichPart, upgradePart, similarity, gradeConflict, posConflict, normName } from "../src/pipeline.js";
import { DEMO_18 } from "../src/demoData.js";

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];

async function loadRows() {
  if (!src) return DEMO_18;
  const data = /^https?:\/\//.test(src)
    ? await (await fetch(src)).json()
    : JSON.parse(readFileSync(src, "utf8"));
  return Array.isArray(data) ? data : data.parts;
}

const raw = await loadRows();
// Stored rows are already enriched (they carry ltype); raw rows are not.
const parts = raw.map((p) => (p.ltype ? upgradePart(p) : enrichPart(p)))
  .filter((p) => p.ltype === "Supplier Part" && !p.review);

const reps = new Map();
for (const p of parts) {
  const k = [p.make, normName(p.part_name), p.npn, p.grade, p.unit_basis].join("|");
  if (!reps.has(k)) reps.set(k, p);
}
const lines = [...reps.values()];
console.log(`Loaded ${raw.length} rows → ${parts.length} benchmark lines → ${lines.length} distinct after collapsing repeats`);

const TOKEN_WEIGHT = 0.6;   // must mirror the app default cfg
const MAX_PER_LINE = 3;
const SEED = 20260923;
// [lo, hi) similarity → pairs to sample. ~200 human labels in total.
const BANDS = [
  [0.00, 0.30, 10],
  [0.30, 0.45, 15],
  [0.45, 0.55, 25],
  [0.55, 0.60, 25],
  [0.60, 0.65, 30],
  [0.65, 0.70, 30],
  [0.70, 0.80, 30],
  [0.80, 0.95, 10],
  [0.95, 1.01, 35],
];

const auto = [];
const pool = BANDS.map(() => []);
let blocked = 0;
for (let i = 0; i < lines.length; i++) {
  for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j];
    if (a.make !== b.make) continue;
    if (gradeConflict(a.grade, b.grade) || a.unit_basis !== b.unit_basis || posConflict(a.part_name, b.part_name, false)) { blocked++; continue; }
    const sim = similarity(a.part_name, b.part_name, TOKEN_WEIGHT);
    if (a.npn && a.npn === b.npn) { auto.push({ a, b, sim }); continue; }
    const k = BANDS.findIndex(([lo, hi]) => sim >= lo && sim < hi);
    pool[k].push({ a, b, sim });
  }
}

// mulberry32 — seeded so the same input always yields the same sample
let s = SEED;
const rand = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

const uses = new Map();
const human = [];
BANDS.forEach(([lo, hi, want], k) => {
  let took = 0; const from = human.length;
  for (const p of shuffle(pool[k])) {
    if (took >= want) break;
    if ((uses.get(p.a.id) || 0) >= MAX_PER_LINE || (uses.get(p.b.id) || 0) >= MAX_PER_LINE) continue;
    uses.set(p.a.id, (uses.get(p.a.id) || 0) + 1);
    uses.set(p.b.id, (uses.get(p.b.id) || 0) + 1);
    human.push({ ...p, band: `${lo.toFixed(2)}-${Math.min(hi, 1).toFixed(2)}` });
    took++;
  }
  for (const p of human.slice(from)) p.weight = pool[k].length / took;
  console.log(`  band ${lo.toFixed(2)}–${Math.min(hi, 1).toFixed(2)}: ${String(took).padStart(3)} sampled of ${pool[k].length}`);
});

const all = [...shuffle(human), ...auto.map((p) => ({ ...p, band: "same-pn", auto: true }))];

const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const rows = [["pair_id","label","part_name_a","part_number_a","part_name_b","part_number_b","make","model_a","model_b",
  "unit_a","unit_b","supplier_a","supplier_b","bill_a","bill_b","date_a","date_b","grade_a","grade_b","unit_basis",
  "category_a","category_b","band","similarity","weight"].join(",")];
all.forEach((p, k) => {
  rows.push([
    k + 1, p.auto ? "y (auto)" : "",
    esc(p.a.part_name), esc(p.a.part_number), esc(p.b.part_name), esc(p.b.part_number),
    esc(p.a.make), esc(p.a.model), esc(p.b.model),
    p.a.unit, p.b.unit, esc(p.a.supplier), esc(p.b.supplier), esc(p.a.bill_no), esc(p.b.bill_no),
    esc(p.a.bill_date), esc(p.b.bill_date), esc(p.a.grade), esc(p.b.grade), p.a.unit_basis,
    esc(p.a.cat), esc(p.b.cat), p.band, p.sim.toFixed(4), (p.weight || 1).toFixed(2),
  ].join(","));
});

mkdirSync(here, { recursive: true });
const out = join(here, "gold_pairs.csv");
writeFileSync(out, rows.join("\n") + "\n");

console.log(`\n${blocked} pairs skipped — the app's grade / basis / positional guards never merge them`);
console.log(`Wrote ${all.length} pairs → ${out}`);
console.log(`  ${human.length} need a human label: fill "label" with y / n (or ? to skip)`);
console.log(`  ${auto.length} pre-labeled "y (auto)" (identical part numbers — ground truth)`);
console.log(`\nThen score with:  npm run eval:score   (add -- --human-only to leave the auto rows out)`);
