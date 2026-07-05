/* PartsIndex pipeline & matcher — pure functions, no browser deps.
   Imported by the React app AND by the eval harness (eval/*.mjs),
   so the gold-set evaluation scores the exact code the app runs. */

/* ================= enrichment pipeline ================= */
export function normPN(pn = "") {
  let p = String(pn).toUpperCase().trim();
  p = p.replace(/\(.*?\)/g, "").split("/")[0].replace(/\s*9{3,}$/, "").replace(/[\s\-.]/g, "");
  return p.trim();
}
export const CAT_RULES = [
  ["Fog Lamp", ["fog lamp","fog"]], ["Signal/Marker Lamp", ["turn signal","signal len","side marker","ambient lamp"]],
  ["Headlamp", ["headlamp","head lamp","h lamp","h/lamp","hlamp"]], ["Bumper Reinforcement", ["reinforcment","reinforcement","reinf"]],
  ["Bumper Bracket/Retainer", ["bumper stay","bumper bracket","retainer","bumper side","sponge","lower bracket"]],
  ["Front Bumper", ["front bumper","frt bumper","fr bumper","face,fr bumper","bumper set","trim bumper","cover bumper","bumper 09","bumper fr"]],
  ["Bumper Cover/Tow", ["tow cover","cover towing","cover strip","spoiler"]], ["Grille", ["grille","garnish,fr bumper"]],
  ["Fender Liner/Mudguard", ["fender liner","wheel mud","mudguard","fender shield","mudflat","wheel house","wheel arch"]],
  ["Fender", ["fender","apron"]], ["Mirror", ["mirror"]], ["Glass", ["windshield","windscreen","w/s glass","fixed window","glass"]],
  ["Door Handle", ["door handle"]], ["Door Panel", ["door"]], ["Hood/Bonnet Hinge", ["bonnet hinge","hood hinge"]],
  ["Hood/Bonnet", ["hood","bonnet"]], ["Wiper", ["wiper"]], ["Absorber/Damper", ["absorber","damper","spring element"]],
  ["Sensor", ["sensor"]], ["Radiator Ancillary", ["radiator guide","air guide","radiator bracket","spare tank","reservoir","radiator clip"]],
  ["Radiator/Cooling", ["radiator","coolant","condenser","cooling fan","fan"]],
  ["Suspension/Steering Arm", ["tie rod","ball joint","lower arm","knuckle","control arm","stabilizer","anti roll","hub bearing","subframe"]],
  ["Steering Gear", ["steering gear","gear assy, steering","gear box"]],
  ["Structural Panel", ["cross member","panel sub-assy","reinforcement assy","chassis frame","pillar","bulkhead","support panel","valance","cowl","member"]],
  ["Seat", ["seat"]], ["Dashboard", ["dashboard","instrument","meter assy","console"]],
  ["Electronic Module", ["control unit","ecu","module","cable reel","airbag","antenna"]],
  ["Seal/Weatherstrip", ["weatherstrip","sealing","seal ","insulation"]], ["Lock/Mechanism", ["lock","hinge","stiffener"]],
  ["Consumable/Fastener", ["clip","rivet","bolt","screw"," nut","plug","grommet","treenail","tape","logo","mark","emblem","sticker","label","sundry"]],
];
export function categorise(name = "") {
  const n = " " + String(name).toLowerCase() + " ";
  for (const [cat, keys] of CAT_RULES) if (keys.some((k) => n.includes(k))) return cat;
  return "Other";
}
export const MAKE_PREFIX = [
  [/^MB[AN]/, "Mercedes-Benz"], [/^41588|^41582|^41580|^00088[28]/, "Mercedes-Benz"], [/^HY|^KA5/, "Hyundai"],
  [/^8[RK]|^4[GHFD]|^WAUZ/, "Audi"], [/^V5C5|^VN9|^VWV/, "Volkswagen"], [/^513/, "BMW"], [/^M9\d/, "Chevrolet"],
  [/^M[KCLEBRS]\d/, "Mitsubishi Fuso"], [/^T\d{4,}/, "Toyota"],
];
export function inferMake(pn = "", billMake = "") {
  if (billMake && billMake !== "Unknown") return billMake;
  const p = normPN(pn);
  for (const [re, mk] of MAKE_PREFIX) if (re.test(p)) return mk;
  return billMake || "Unknown";
}
export function lineType(docType = "", cat = "") {
  const d = String(docType).toLowerCase();
  if (d.includes("estimate")) return "Repair Estimate";
  if (cat === "Consumable/Fastener") return "Consumable / Fastener";
  if (d.includes("labour")) return "Labour";
  return "Supplier Part";
}
/* ---- grade / GST / unit-basis (the biggest legitimate price drivers) ---- */
export const GRADES = ["OEM Genuine", "OES", "Aftermarket", "Used/Recon", "Unknown"];
// Infer grade from part-name tags common on SG supplier bills. A value supplied
// by OCR or an Excel column always wins; this is only a text-tag fallback.
export function inferGrade(name = "", provided = "") {
  const p = String(provided).trim();
  if (p && GRADES.includes(p)) return p;
  const n = " " + String(name).toLowerCase() + " ";
  if (/\b(used|recon|reconditioned|secondhand|s\/h|2nd hand)\b/.test(n)) return "Used/Recon";
  if (/\(original\)|\boriginal\b|\bgenuine\b|\bgen\b/.test(n)) return "OEM Genuine";
  if (/\boes\b/.test(n)) return "OES";
  if (/\baftermarket\b|\bafter market\b|\bapm\b|\breplacement\b|\(tw\)|\btaiwan\b|\bcopy\b|\bimitation\b/.test(n)) return "Aftermarket";
  return "Unknown";
}
// True only when BOTH grades are known and differ — an Unknown never blocks a merge.
export function gradeConflict(a, b) {
  return a && b && a !== "Unknown" && b !== "Unknown" && a !== b;
}
// each | pair | set — priced-per-pair or per-set lines corrupt a per-unit median silently.
export function inferUnitBasis(name = "", provided = "") {
  const p = String(provided).trim().toLowerCase();
  if (["each", "pair", "set"].includes(p)) return p;
  const n = " " + String(name).toLowerCase() + " ";
  if (/\bset\b/.test(n)) return "set";
  if (/\(pair\)|\bpair\b|lh\/rh|rh\/lh|rhs\/lhs|lhs\/rhs|rh & lh|lh & rh|\bl\/r\b/.test(n)) return "pair";
  return "each";
}
export function enrichPart(raw) {
  const qty = Number(raw.qty) || 1;
  let unit = Number(raw.unit_cost);
  const total = Number(raw.total_cost) || (unit ? unit * qty : 0);
  if (!unit && total && qty) unit = +(total / qty).toFixed(2);
  const cat = categorise(raw.part_name);
  const make = inferMake(raw.part_number, raw.make);
  const gst = ["incl", "excl"].includes(String(raw.gst || "").toLowerCase()) ? String(raw.gst).toLowerCase() : "unknown";
  return {
    id: raw.id || crypto.randomUUID(), bill_no: raw.bill_no || "", supplier: raw.supplier || "", bill_date: raw.bill_date || "",
    make, model: raw.model || "—", part_name: raw.part_name || "", part_number: raw.part_number || "",
    npn: normPN(raw.part_number), cat, qty, unit, total, ltype: lineType(raw.doc_type, cat),
    doc_type: raw.doc_type || "Tax Invoice", src: raw.src || "excel",
    grade: inferGrade(raw.part_name, raw.grade),          // OEM Genuine | OES | Aftermarket | Used/Recon | Unknown
    unit_basis: inferUnitBasis(raw.part_name, raw.unit_basis), // each | pair | set
    gst,                                                  // incl | excl | unknown (invoice-level, repeated per line)
    review: !!raw.review, review_reason: raw.review_reason || "",
  };
}
/* ---- OCR reconciliation gate ----
   Compare the sum of extracted line totals against the invoice's own printed
   parts subtotal (preferred) or total. Cheapest, highest-yield OCR QA check:
   a mismatch means lines were missed, duplicated, or misread. */
export function reconcileInvoice(extractedParts, doc) {
  const sum = +(extractedParts.reduce((s, p) => s + (Number(p.total_cost) || 0), 0)).toFixed(2);
  const stated = Number(doc.parts_subtotal) || Number(doc.invoice_total) || 0;
  if (!stated) return { ok: null, sum, stated: 0, diff: 0, basis: "none" }; // nothing printed to check against
  const diff = +(sum - stated).toFixed(2);
  const tol = Math.max(1, stated * 0.005); // S$1 or 0.5%, whichever is larger
  return { ok: Math.abs(diff) <= tol, sum, stated, diff, basis: doc.parts_subtotal ? "parts subtotal" : "invoice total" };
}
export const median = (a) => { const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
export const mean = (a) => a.reduce((x,y)=>x+y,0)/a.length;

/* ================= fuzzy name matching ================= */
export const STOP = new Set(["assy","assembly","unit","fr","frt","front","rh","lh","l","r","w","o","the","of","for","with","09","and"]);
export function normName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/).filter((t) => t && !STOP.has(t)).join(" ").trim();
}
export function toks(s) { return new Set(normName(s).split(" ").filter(Boolean)); }
export function jaccard(a, b) { const A=toks(a),B=toks(b); let i=0; for(const x of A) if(B.has(x)) i++; const u=A.size+B.size-i; return u?i/u:0; }
export function levSim(a, b) {
  a = normName(a); b = normName(b); const m=a.length,n=b.length;
  if (!m || !n) return 0;
  const d = Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
  for (let j=0;j<=n;j++) d[0][j]=j;
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return 1 - d[m][n]/Math.max(m,n,1);
}
// combined similarity, token weight configurable
export function similarity(a, b, tokenWeight = 0.6) {
  return tokenWeight * jaccard(a, b) + (1 - tokenWeight) * levSim(a, b);
}
// A model key that keeps different variants apart (strip trailing bracket notes like "(W213)").
export function modelKey(p) { return String(p.model || "").replace(/\(.*?\)/g, "").trim().toLowerCase() || "—"; }

/* Cluster usable parts.
   cfg = { mode:'hybrid'|'fuzzy-name'|'exact-pn'|'category', threshold, sameMake, sameModel, tokenWeight, bridge }
   HYBRID (default & recommended): group by exact normalised part number first (definitely the
   same part), then optionally BRIDGE groups whose names are fuzzy-similar within the same make
   (and model, if enabled) — so OEM/aftermarket variants merge, but a Camry headlamp never merges
   with a Hilux headlamp. */
export function buildClusters(parts, cfg) {
  const usable = parts.filter((p) => p.ltype === "Supplier Part" && !p.review);

  if (cfg.mode === "exact-pn") {
    const g = {}; usable.forEach((p) => { const k = p.npn || "?"; (g[k] = g[k] || []).push(p); });
    return Object.values(g).map((mem) => makeCluster(mem)).sort((a, b) => b.n - a.n);
  }
  if (cfg.mode === "category") {
    const g = {}; usable.forEach((p) => { const k = (cfg.sameMake ? p.make + " · " : "") + p.cat; (g[k] = g[k] || []).push(p); });
    return Object.values(g).map((mem) => makeCluster(mem)).sort((a, b) => b.n - a.n);
  }
  if (cfg.mode === "fuzzy-name") {
    return fuzzyAgglomerate(usable, cfg).sort((a, b) => b.n - a.n);
  }

  // ---- hybrid (default) ----
  // 1) seed groups by exact normalised part number
  const byPN = {};
  usable.forEach((p) => { const k = p.npn || ("~" + p.id); (byPN[k] = byPN[k] || []).push(p); });
  let groups = Object.entries(byPN).map(([pn, mem]) => ({ pn, mem }));

  // 2) optionally bridge PN-groups by fuzzy name within make (+ model)
  if (cfg.bridge) {
    const used = new Array(groups.length).fill(false);
    const merged = [];
    for (let i = 0; i < groups.length; i++) {
      if (used[i]) continue; used[i] = true;
      const acc = [...groups[i].mem];
      const a = groups[i].mem[0];
      for (let j = i + 1; j < groups.length; j++) {
        if (used[j]) continue;
        const b = groups[j].mem[0];
        if (cfg.sameMake && a.make !== b.make) continue;
        if (cfg.sameModel && modelKey(a) !== modelKey(b)) continue;
        if (cfg.sepGrade !== false && gradeConflict(a.grade, b.grade)) continue; // never merge OEM with aftermarket
        if (a.unit_basis !== b.unit_basis) continue;                             // per-pair prices must not join per-each medians
        if (similarity(a.part_name, b.part_name, cfg.tokenWeight) >= cfg.threshold) {
          acc.push(...groups[j].mem); used[j] = true;
        }
      }
      merged.push(acc);
    }
    return merged.map((mem) => makeCluster(mem)).sort((a, b) => b.n - a.n);
  }
  return groups.map((g) => makeCluster(g.mem)).sort((a, b) => b.n - a.n);
}

export function fuzzyAgglomerate(usable, cfg) {
  const used = new Array(usable.length).fill(false);
  const clusters = [];
  for (let i = 0; i < usable.length; i++) {
    if (used[i]) continue; used[i] = true;
    const mem = [usable[i]];
    for (let j = i + 1; j < usable.length; j++) {
      if (used[j]) continue;
      if (cfg.sameMake && usable[i].make !== usable[j].make) continue;
      if (cfg.sameModel && modelKey(usable[i]) !== modelKey(usable[j])) continue;
      if (cfg.sepGrade !== false && gradeConflict(usable[i].grade, usable[j].grade)) continue;
      if (usable[i].unit_basis !== usable[j].unit_basis) continue;
      if (similarity(usable[i].part_name, usable[j].part_name, cfg.tokenWeight) >= cfg.threshold) {
        used[j] = true; mem.push(usable[j]);
      }
    }
    clusters.push(makeCluster(mem));
  }
  return clusters;
}

export function makeCluster(mem) {
  const units = mem.map((m) => m.unit);
  const names = [...new Set(mem.map((m) => m.part_name))];
  const pns = [...new Set(mem.map((m) => m.npn).filter(Boolean))];
  const rawPns = [...new Set(mem.map((m) => m.part_number).filter(Boolean))];
  const sup = [...new Set(mem.map((m) => m.supplier))];
  const grades = [...new Set(mem.map((m) => m.grade))];
  const knownGrades = grades.filter((g) => g !== "Unknown");
  const med = median(units), av = mean(units);
  // A cluster spanning >1 distinct part number was name-bridged, not PN-identical → lower certainty.
  const bridged = pns.length > 1;
  return {
    key: (pns[0] || names[0] || "?") + "|" + mem[0].make, label: names[0] || rawPns[0] || "?",
    names, pns, rawPns, members: mem, bridged,
    grades, grade: knownGrades.length === 1 ? knownGrades[0] : (knownGrades.length > 1 ? "Mixed" : "Unknown"),
    gradeMixed: knownGrades.length > 1, unit_basis: mem[0].unit_basis,
    make: mem[0].make, model: mem[0].model, cat: mem[0].cat, suppliers: sup,
    n: mem.length, min: Math.min(...units), med: +med.toFixed(2), avg: +av.toFixed(2),
    max: Math.max(...units), spread: +(Math.max(...units) - Math.min(...units)).toFixed(2),
    dates: mem.map((m) => m.bill_date).filter(Boolean),
  };
}
export function parseDate(s) {
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null; let y = +m[3]; if (y < 100) y += 2000;
  return new Date(y, +m[2] - 1, +m[1]);
}

/* ---- stored-dataset migration ----
   Parts are enriched ONCE at ingest and then persisted, so a dataset stored by
   an older app version lacks fields added since (grade, unit_basis, gst, review,
   …). Left alone, those undefined fields render as empty badges and dodge the
   grade/basis merge guards. upgradePart back-fills anything missing on load —
   values that are already present and valid always win. */
export function upgradePart(p) {
  const qty = Number(p.qty) || 1;
  let unit = Number(p.unit) || 0; const total = Number(p.total) || 0;
  if (!unit && total) unit = +(total / qty).toFixed(2);
  return {
    ...p,
    id: p.id || crypto.randomUUID(),
    npn: p.npn != null ? p.npn : normPN(p.part_number),
    cat: p.cat || categorise(p.part_name),
    ltype: p.ltype || lineType(p.doc_type, p.cat || categorise(p.part_name)),
    qty, unit, total,
    grade: GRADES.includes(p.grade) ? p.grade : inferGrade(p.part_name, p.grade),
    unit_basis: UNIT_BASES.includes(p.unit_basis) ? p.unit_basis : inferUnitBasis(p.part_name, p.unit_basis),
    gst: ["incl", "excl"].includes(String(p.gst || "").toLowerCase()) ? String(p.gst).toLowerCase() : "unknown",
    review: !!p.review, review_reason: p.review_reason || "",
  };
}

/* ================= OCR output schema validation =================
   Validates one extracted invoice object BEFORE it is allowed anywhere near
   the dataset. Catches model output drift (missing fields, wrong types,
   invented enum values) at ingest time instead of as a corrupted benchmark
   three weeks later. Coercible problems are downgraded to warnings and fixed
   on a copy; structural problems are errors and the invoice is rejected. */
const UNIT_BASES = ["each", "pair", "set"];
const GST_VALUES = ["incl", "excl", "unknown"];
export function validateInvoice(j) {
  const errors = [], warnings = [];
  if (!j || typeof j !== "object" || Array.isArray(j)) {
    return { ok: false, errors: ["response is not a JSON object"], warnings, invoice: null };
  }
  const inv = JSON.parse(JSON.stringify(j)); // work on a copy; coercions never mutate the input
  const str = (v) => (v == null ? "" : String(v));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

  inv.supplier_name = str(inv.supplier_name).trim();
  inv.bill_no = str(inv.bill_no).trim();
  if (!inv.supplier_name) warnings.push("supplier_name is empty");
  if (!inv.bill_no) warnings.push("bill_no is empty — duplicate detection is impossible for this bill");

  if (!["Tax Invoice", "Repair Estimate"].includes(inv.doc_type)) {
    warnings.push(`doc_type "${str(inv.doc_type)}" is not in the schema — coerced to "Tax Invoice"`);
    inv.doc_type = "Tax Invoice";
  }
  if (!GST_VALUES.includes(inv.gst_treatment)) {
    if (inv.gst_treatment != null && str(inv.gst_treatment) !== "") warnings.push(`gst_treatment "${str(inv.gst_treatment)}" invalid — coerced to "unknown"`);
    inv.gst_treatment = "unknown";
  }
  for (const f of ["parts_subtotal", "gst_amount", "invoice_total"]) {
    const n = num(inv[f]);
    if (Number.isNaN(n)) { warnings.push(`${f} is not a number — set to 0`); inv[f] = 0; }
    else inv[f] = n;
  }

  if (!Array.isArray(inv.parts)) { errors.push("parts is missing or not an array"); inv.parts = []; }
  else if (inv.parts.length === 0) errors.push("parts array is empty — nothing was extracted");

  inv.parts = inv.parts.map((p, i) => {
    const row = { ...p };
    row.part_name = str(row.part_name).trim();
    row.part_number = str(row.part_number).trim();
    if (!row.part_name && !row.part_number) errors.push(`parts[${i}]: both part_name and part_number are empty`);
    const qty = num(row.qty);
    if (Number.isNaN(qty) || qty < 0) { warnings.push(`parts[${i}] "${row.part_name || row.part_number}": qty invalid — set to 1`); row.qty = 1; }
    else row.qty = qty || 1;
    for (const f of ["unit_cost", "total_cost"]) {
      const n = num(row[f]);
      if (Number.isNaN(n) || n < 0) { if (row[f] != null) warnings.push(`parts[${i}] "${row.part_name || row.part_number}": ${f} invalid — set to 0`); row[f] = 0; }
      else row[f] = n;
    }
    if (!row.unit_cost && !row.total_cost) errors.push(`parts[${i}] "${row.part_name || row.part_number}": no price at all (unit_cost and total_cost both 0)`);
    if (!GRADES.includes(row.grade)) {
      if (row.grade != null && str(row.grade) !== "") warnings.push(`parts[${i}]: grade "${str(row.grade)}" invalid — coerced to "Unknown"`);
      row.grade = "Unknown";
    }
    if (!UNIT_BASES.includes(row.unit_basis)) {
      if (row.unit_basis != null && str(row.unit_basis) !== "") warnings.push(`parts[${i}]: unit_basis "${str(row.unit_basis)}" invalid — coerced to "each"`);
      row.unit_basis = "each";
    }
    return row;
  });

  return { ok: errors.length === 0, errors, warnings, invoice: errors.length === 0 ? inv : null };
}

/* ================= benchmark snapshot fingerprint =================
   Benchmarks shift as bills accumulate. A dispute pack must record WHICH
   benchmark state produced its numbers, or a figure quoted in a negotiation
   is irreproducible three weeks later. The snapshot id hashes (a) every line
   that feeds the benchmark and (b) the matching configuration. Same data +
   same config => same id, on any machine. */
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
export function datasetFingerprint(parts) {
  const lines = parts
    .map((p) => [p.supplier, p.bill_no, p.npn || p.part_number, p.part_name, p.unit, p.qty, p.grade, p.unit_basis, p.gst, p.review ? 1 : 0].join("\u001f"))
    .sort();
  return fnv1a(lines.join("\u001e"));
}
export function configFingerprint(cfg) {
  const keys = Object.keys(cfg || {}).sort();
  return fnv1a(keys.map((k) => k + "=" + JSON.stringify(cfg[k])).join("&"));
}
export function snapshotId(parts, cfg) {
  return `PIX-${datasetFingerprint(parts)}-${configFingerprint(cfg)}`;
}

/* ================= dispute pack =================
   Turns an Assess-a-Claim result into the three tables an adjuster attaches
   to a negotiation: a summary (what/when/against which benchmark state), the
   line-by-line assessment, and — the part that makes the number defensible —
   the full evidence trail: every underlying supplier quote behind every
   benchmark used, down to bill number and date. Pure function so it is
   unit-testable in Node; the app maps the three arrays onto xlsx sheets. */
export function buildDisputePack(rows, cfg, meta) {
  const matched = rows.filter((r) => r.bench != null);
  const totQuoted = matched.reduce((s, r) => s + r.quoted, 0);
  const totBench = matched.reduce((s, r) => s + r.bench, 0);
  const totOver = matched.reduce((s, r) => s + (r.over > 0 ? r.over : 0), 0);
  const MODES = { hybrid: "Hybrid (part-number first" , "fuzzy-name": "Fuzzy part name", "exact-pn": "Exact part number", category: "Category" };
  const modeLabel = (MODES[cfg.mode] || cfg.mode) + (cfg.mode === "hybrid" ? (cfg.bridge ? ", name bridging ON)" : ", name bridging OFF)") : "");

  const summary = [
    ["Claim reference", meta.claimRef || "—"],
    ["Generated", meta.generatedAt],
    ["Generated by", `PartsIndex v${meta.appVersion}`],
    ["Benchmark snapshot", meta.snapshotId],
    ["Reference dataset", `${meta.invoices} invoices · ${meta.usableLines} usable supplier-part lines`],
    ["Matching mode", modeLabel],
    ["Similarity threshold", cfg.threshold],
    ["Token weight", cfg.tokenWeight],
    ["Same make required", cfg.sameMake ? "yes" : "no"],
    ["Same model required", cfg.sameModel ? "yes" : "no"],
    ["Grades kept separate", cfg.sepGrade !== false ? "yes" : "no"],
    ["Inflation flag threshold", `+${meta.inflPct}% over median`],
    ["Lines assessed", rows.length],
    ["Lines matched to a benchmark", matched.length],
    ["Quoted total (matched lines), S$", +totQuoted.toFixed(2)],
    ["Benchmark total (matched lines), S$", +totBench.toFixed(2)],
    ["Potential over-claim, S$", +totOver.toFixed(2)],
    ["Lines flagged", rows.filter((r) => r.flagged).length],
    ["Note", "Potential over-claim sums only lines quoted above their benchmark median. Benchmarks with few quotes are indicative; the Evidence sheet lists every underlying supplier quote so each figure can be verified against source bills. Reproducible: same snapshot id = same data + same matching configuration."],
  ].map(([f, v]) => ({ Field: f, Value: v }));

  const lines = rows.map((r, i) => ({
    "Line": i + 1,
    "Part No (estimate)": r.pn,
    "Description (estimate)": r.name,
    "Quoted S$": r.quoted,
    "Matched via": r.how,
    "Match score": r.how === "name" ? r.score : r.how === "part number" ? 1 : "",
    "Benchmark cluster": r.cluster ? r.cluster.label : "no match",
    "Cluster basis": r.cluster ? (r.cluster.bridged ? "name-bridged (≈)" : "part number") : "",
    "Grade": r.cluster ? r.cluster.grade : "",
    "Unit basis": r.cluster ? r.cluster.unit_basis : "",
    "Quotes (n)": r.n || "",
    "Suppliers (n)": r.cluster ? r.cluster.suppliers.length : "",
    "Benchmark median S$": r.bench != null ? r.bench : "",
    "Evidence min S$": r.cluster ? r.cluster.min : "",
    "Evidence max S$": r.cluster ? r.cluster.max : "",
    "Evidence dates": r.cluster ? evidenceDateRange(r.cluster) : "",
    "Variance S$": r.over != null ? r.over : "",
    "Variance %": r.overPct != null ? r.overPct : "",
    "Flagged": r.flagged ? "YES" : "",
  }));

  const evidence = [];
  rows.forEach((r, i) => {
    if (!r.cluster) return;
    r.cluster.members.forEach((m) => evidence.push({
      "Line": i + 1,
      "Estimate part": r.name,
      "Evidence part name": m.part_name,
      "Part number": m.part_number || "",
      "Supplier": m.supplier,
      "Bill no": m.bill_no,
      "Bill date": m.bill_date || "",
      "Grade": m.grade,
      "Unit basis": m.unit_basis,
      "Unit price S$": m.unit,
      "Source": m.src === "ocr" ? "Claude OCR of supplier bill" : "Excel import",
    }));
  });

  return { summary, lines, evidence };
}
export function evidenceDateRange(c) {
  const ds = c.dates.map(parseDate).filter(Boolean).sort((a, b) => a - b);
  if (!ds.length) return "—";
  const f = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return ds.length === 1 ? f(ds[0]) : `${f(ds[0])} – ${f(ds[ds.length - 1])}`;
}
