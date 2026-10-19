// Compares candidate benchmark statistics on the saved live data (read-only).
// Leave-one-out: for each quote, compute the benchmark from the other quotes in its cluster and
// measure how far the held-out quote is from it (log ratio, so $40 and $4,000 parts count equally).
// Usage: node bench_compare.mjs [live_parts_<date>.json]   (default: the 15 Oct 2026 snapshot in this folder)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = await import(pathToFileURL(path.resolve(HERE, "../../src/pipeline.js")).href);
const raw = JSON.parse(fs.readFileSync(path.join(HERE, process.argv[2] || "live_parts_2026-10-15.json"), "utf8"));
const cfg = { mode: "fuzzy-name", threshold: 0.65, sameMake: true, sameModel: false, tokenWeight: 0.6, bridge: false, sepGrade: true, sepSide: false, minQuotes: 4, maxAgeYears: 0 };
const cl = P.buildClusters(raw.parts.map(P.upgradePart), cfg).filter((c) => c.n >= 3);
const trim = (a, f) => { const s = [...a].sort((x, y) => x - y), k = Math.floor(s.length * f); return P.mean(s.slice(k, s.length - k)); };
const geo = (a) => Math.exp(P.mean(a.map(Math.log)));
const hl = (a) => { const w = []; for (let i = 0; i < a.length; i++) for (let j = i; j < a.length; j++) w.push((a[i] + a[j]) / 2); return P.median(w); }; // Hodges–Lehmann
const est = { mean: P.mean, median: P.median, "trimmed 20%": (a) => trim(a, 0.2), "geometric mean": geo, "Hodges-Lehmann": hl };
const run = (set, label) => {
  const out = {};
  for (const [k, f] of Object.entries(est)) {
    const errs = [];
    for (const c of set) { const u = c.members.map((m) => m.unit).filter((x) => x > 0);
      for (let i = 0; i < u.length; i++) { const rest = u.filter((_, j) => j !== i); const b = f(rest); if (b > 0) errs.push(Math.abs(Math.log(u[i] / b))); } }
    out[k] = { medianMiss: +((Math.exp(P.median(errs)) - 1) * 100).toFixed(1) + "%", within25: +(100 * errs.filter((e) => e <= Math.log(1.25)).length / errs.length).toFixed(1) + "%" };
  }
  console.log(`\n${label}: ${set.length} clusters, ${set.reduce((s, c) => s + c.n, 0)} quotes`); console.table(out);
};
run(cl, "All clusters with 3+ quotes");
run(cl.filter((c) => !c.nameJoined), "Same part number only");
run(cl.filter((c) => c.nameJoined), "Name-matched (mixed part numbers)");
const sizes = P.buildClusters(raw.parts.map(P.upgradePart), cfg).reduce((a, c) => (a[c.n >= 10 ? "10+" : c.n >= 4 ? "4-9" : c.n] = (a[c.n >= 10 ? "10+" : c.n >= 4 ? "4-9" : c.n] || 0) + 1, a), {});
console.log("cluster sizes:", sizes);
// skew: mean vs median gap
const big = cl.filter((c) => c.n >= 4); console.log("4+ clusters where mean > median by 20%+:", big.filter((c) => c.avg > c.med * 1.2).length, "of", big.length);
