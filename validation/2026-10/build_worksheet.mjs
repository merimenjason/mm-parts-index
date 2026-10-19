// Builds the data-validation worksheet from the LIVE shared reference (read-only GET).
// Usage: node build_worksheet.mjs [repoRoot] [outDir]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = process.argv[2] || path.resolve(HERE, "../..");
const OUT = process.argv[3] || HERE;
const URL_ = "https://mm-parts-index.vercel.app/api/parts";

const P = await import(pathToFileURL(path.join(REPO, "src/pipeline.js")).href);
const XLSX = createRequire(path.join(REPO, "package.json"))("xlsx");

// Same defaults as the app's cfg useState (src/PartsIndex.jsx); flagNameJoined left undefined (off).
const cfg = { mode: "fuzzy-name", threshold: 0.65, sameMake: true, sameModel: false, tokenWeight: 0.6,
  bridge: false, sepGrade: true, sepSide: false, minQuotes: 4, maxAgeYears: 0 };

const res = await fetch(URL_);
if (!res.ok) throw new Error(`GET ${URL_} → ${res.status}`);
const raw = await res.json();
const fetchedAt = new Date().toISOString();
const stamp = fetchedAt.slice(0, 10);
fs.writeFileSync(path.join(OUT, `live_parts_${stamp}.json`), JSON.stringify(raw));

const parts = (raw.parts || []).map(P.upgradePart);
const snap = P.snapshotId(parts.filter((p) => !p.review), cfg);
const clusters = P.buildClusters(parts, cfg);
const reliable = clusters.filter((c) => c.n >= cfg.minQuotes);

const ratio = (c) => (c.min > 0 ? c.max / c.min : Infinity);
const cvPct = (c) => (c.avg ? (P.stdev(c.members.map((m) => m.unit)) / c.avg) * 100 : NaN);
const distinctPrices = (c) => new Set(c.members.map((m) => m.unit)).size;

// --- sample ---
const picked = new Map(); // key -> reasons[]
const add = (c, why) => { if (!picked.has(c.key)) picked.set(c.key, { c, why: [] }); picked.get(c.key).why.push(why); };
reliable.filter((c) => ratio(c) >= 5).forEach((c) => add(c, "Wide range (max/min ≥ 5×)"));
reliable.filter((c) => cvPct(c) >= 50).forEach((c) => add(c, "High spread (CV ≥ 50%)"));
reliable.filter((c) => /head ?lamp/i.test(c.cat + " " + c.label) && ratio(c) >= 3)
  .forEach((c) => add(c, "Headlamp (example raised on the call)"));
const controls = reliable
  .filter((c) => !picked.has(c.key) && c.suppliers.length >= 2 && distinctPrices(c) > 1)
  .sort((a, b) => cvPct(a) - cvPct(b)).slice(0, 5);
controls.forEach((c) => add(c, `Control (tightest spread: CV ${cvPct(c).toFixed(0)}%, ≥2 suppliers)`));

const sample = [...picked.values()].sort((a, b) => {
  const ca = a.why[0].startsWith("Control"), cb = b.why[0].startsWith("Control");
  return ca - cb || ratio(b.c) - ratio(a.c);
});

// --- sheets ---
const CAUSES = [
  ["SAME", "Same part — price difference is genuine market variation"],
  ["SUBPART", "Different part — sub-component, bracket, clip or cover vs the full assembly"],
  ["VEHICLE", "Same part name, but for a different vehicle/model (not interchangeable)"],
  ["POSITION", "Different position (front/rear, upper/lower, inner/outer)"],
  ["GRADE", "Different grade (genuine vs aftermarket vs used/recon)"],
  ["PAIR", "Line prices a pair or set, not a single unit"],
  ["OCR", "OCR error — misread price, part number, or value bled from another row"],
  ["UNKNOWN", "Cannot tell from the bill and an online lookup"],
];

const clusterRows = [], lineRows = [];
sample.forEach(({ c, why }, i) => {
  const id = "C" + String(i + 1).padStart(2, "0");
  clusterRows.push({
    "Cluster": id, "Why sampled": why.join("; "), "Benchmark label": c.label, "Make": c.make,
    "Category": c.cat, "Models": c.models.join(", ") || "(none recorded)", "Quotes": c.n,
    "Suppliers": c.suppliers.length, "Distinct bills": new Set(c.members.map((m) => m.supplier + "|" + m.bill_no)).size,
    "Distinct part nos": c.pns.length, "Distinct prices": distinctPrices(c),
    "Grades": c.grades.join(", "), "Min S$": c.min, "Median S$": c.med, "Max S$": c.max,
    "Max/Min": +ratio(c).toFixed(2), "CV %": +cvPct(c).toFixed(1),
    "Part names in cluster": c.names.join(" | "),
    "VERDICT (fill)": "", "Notes (fill)": "",
  });
  [...c.members].sort((a, b) => a.unit - b.unit).forEach((m) => {
    const pnShared = m.npn ? c.members.filter((o) => o.npn === m.npn).length : 0;
    const q = encodeURIComponent([m.part_number || m.part_name, m.make !== "Unknown" ? m.make : ""].join(" ").trim());
    lineRows.push({
      "Cluster": id, "Benchmark label": c.label, "Cluster median S$": c.med,
      "Line S$": m.unit, "× median": c.med ? +(m.unit / c.med).toFixed(2) : "",
      "Part name (as billed)": m.part_name, "Part number (as billed)": m.part_number || "",
      "Same PN in cluster": pnShared, "Make": m.make, "Model": m.model || "", "Grade": m.grade,
      "Unit basis": m.unit_basis, "Qty": m.qty, "Line total S$": m.total, "GST": m.gst,
      "Supplier": m.supplier, "Bill no": m.bill_no, "Bill date": m.bill_date || "", "Source": m.src || "",
      "Search": q ? "Google" : "",
      "_q": q,
      "Identified as (fill)": "", "Fits vehicle (fill)": "", "CAUSE (fill)": "",
      "Market price S$ (fill)": "", "Source URL (fill)": "", "Notes (fill)": "",
    });
  });
});

const wb = XLSX.utils.book_new();

// README
const readme = [
  ["PartsIndex — data-validation worksheet"],
  [],
  ["Question", "Is each wide price range real market variation, or does the benchmark mix different parts?"],
  ["Data source", URL_ + " (live shared reference, read-only)"],
  ["Fetched", fetchedAt],
  ["Snapshot id", snap],
  ["Dataset", `${parts.length} lines · ${new Set(parts.map((p) => p.supplier + "|" + p.bill_no)).size} bills · ${clusters.length} clusters · ${reliable.length} with ≥${cfg.minQuotes} quotes`],
  ["Matching settings", "App defaults: " + JSON.stringify(cfg)],
  ["Sample", `${sample.length} clusters, ${lineRows.length} lines (${controls.length} of them tight controls)`],
  [],
  ["How to fill in"],
  ["1", "On the Lines sheet, work one cluster at a time. Lines are sorted cheapest first."],
  ["2", "Click the Google link. It searches the part number (more precise than the name). Identify what the part is and which vehicle it fits."],
  ["3", "Enter a CAUSE code (see Causes sheet) for every line. Judge each line against the cluster's typical part, not against the median price."],
  ["4", "A market price is optional. Public prices are a sanity check only: SG pricing is poorly indexed and US prices are not comparable (QA.md §9)."],
  ["5", "On the Clusters sheet, give a VERDICT: REAL (range is genuine), MIXED (contains different parts), or UNSURE."],
  ["6", "The Summary sheet counts the CAUSE codes automatically."],
  [],
  ["Reading the result", "Mostly SAME → the ranges are real and median statistics are adequate. Mostly SUBPART / VEHICLE / POSITION → the matching logic, not the statistics, needs fixing."],
  ["Controls", "The tight clusters are a control: they should come back almost entirely SAME. If they don't, the review criteria are too strict."],
];
const wsR = XLSX.utils.aoa_to_sheet(readme);
wsR["!cols"] = [{ wch: 20 }, { wch: 120 }];
XLSX.utils.book_append_sheet(wb, wsR, "README");

// Summary with live formulas
const nLines = lineRows.length + 1;
const sumAoa = [["Cause", "Meaning", "Lines", "Share of coded lines"]];
CAUSES.forEach(([code, desc], i) => sumAoa.push([code, desc, null, null]));
sumAoa.push(["(blank)", "Not yet coded", null, null]);
const wsS = XLSX.utils.aoa_to_sheet(sumAoa);
const causeCol = Object.keys(lineRows[0]).filter((k) => k !== "_q").indexOf("CAUSE (fill)");
const colL = XLSX.utils.encode_col(causeCol);
const rng = `Lines!$${colL}$2:$${colL}$${nLines}`;
CAUSES.forEach((_, i) => {
  const r = i + 2;
  wsS[`C${r}`] = { t: "n", v: 0, f: `COUNTIF(${rng},A${r})` };
  wsS[`D${r}`] = { t: "n", v: 0, f: `IFERROR(C${r}/(COUNTA(${rng})),0)`, z: "0%" };
});
const br = CAUSES.length + 2;
wsS[`C${br}`] = { t: "n", v: 0, f: `COUNTBLANK(${rng})` };
wsS["!cols"] = [{ wch: 10 }, { wch: 75 }, { wch: 8 }, { wch: 20 }];
XLSX.utils.book_append_sheet(wb, wsS, "Summary");

const wsC = XLSX.utils.json_to_sheet(clusterRows);
wsC["!cols"] = Object.keys(clusterRows[0]).map((k) => ({ wch: k === "Part names in cluster" ? 60 : k === "Why sampled" ? 34 : Math.max(10, k.length + 2) }));
wsC["!autofilter"] = { ref: wsC["!ref"] };
XLSX.utils.book_append_sheet(wb, wsC, "Clusters");

const lineOut = lineRows.map(({ _q, ...r }) => r);
const wsL = XLSX.utils.json_to_sheet(lineOut);
const searchCol = Object.keys(lineOut[0]).indexOf("Search");
lineRows.forEach((r, i) => {
  if (!r._q) return;
  const ref = XLSX.utils.encode_cell({ r: i + 1, c: searchCol });
  wsL[ref].l = { Target: "https://www.google.com/search?q=" + r._q, Tooltip: decodeURIComponent(r._q) };
});
wsL["!cols"] = Object.keys(lineOut[0]).map((k) => ({ wch: /Part name|Identified|Notes|Source URL/.test(k) ? 34 : /Supplier/.test(k) ? 26 : Math.max(9, k.length + 2) }));
wsL["!autofilter"] = { ref: wsL["!ref"] };
XLSX.utils.book_append_sheet(wb, wsL, "Lines");

const wsK = XLSX.utils.aoa_to_sheet([["Code", "Meaning"], ...CAUSES]);
wsK["!cols"] = [{ wch: 10 }, { wch: 80 }];
XLSX.utils.book_append_sheet(wb, wsK, "Causes");

const file = path.join(OUT, `PartsIndex_data_validation_${stamp}.xlsx`);
XLSX.writeFile(wb, file);

console.log(JSON.stringify({
  file, snapshot: snap, lines: parts.length, clusters: clusters.length, reliable: reliable.length,
  sampled: sample.length, sampledLines: lineRows.length, controls: controls.length,
  byReason: sample.reduce((a, s) => { s.why.forEach((w) => (a[w] = (a[w] || 0) + 1)); return a; }, {}),
  top: sample.slice(0, 8).map(({ c }) => `${c.make} · ${c.label} · n=${c.n} · S$${c.min}–${c.max} (${ratio(c).toFixed(1)}×)`),
}, null, 1));
