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
