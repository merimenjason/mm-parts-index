/* Self-test for the batch runner and dispute-pack plumbing — no API calls.
   Run: npm run test:tools  (exits non-zero on any failure) */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { validateInvoice, reconcileInvoice, findDuplicateLines, snapshotId, buildDisputePack, enrichPart, buildClusters, upgradePart, quantile, stdev, dispersion, canonMake, inferMake, posKey, posConflict, parseDate, decideInit, categorise } from "../src/pipeline.js";
import { parseArgs, extractJson, dedupKey, processResult, loadManifest, saveManifest, invoiceToRows, writeOutputs, sha256, buildRequestParams, makeFromFilename } from "./batch-ocr.mjs";
import { buildMakeIndex, planRow } from "./backfill-make.mjs";

let failures = 0;
const ok = (cond, name) => { console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${name}`); if (!cond) failures++; };

const GOOD_INV = {
  supplier_name: "Min Ghee Auto Pte Ltd", bill_no: "MG-1001", bill_date: "12/03/2025",
  make: "Toyota", model: "Corolla", doc_type: "Tax Invoice", gst_treatment: "excl",
  parts_subtotal: 550, gst_amount: 49.5, invoice_total: 599.5,
  parts: [
    { part_name: "HEADLAMP RH (Original)", part_number: "T81110-02M40", qty: 1, unit_cost: 350, total_cost: 350, grade: "OEM Genuine", unit_basis: "each" },
    { part_name: "FR BUMPER COVER", part_number: "T52119-02M50", qty: 1, unit_cost: 200, total_cost: 200, grade: "Unknown", unit_basis: "each" },
  ],
};

console.log("validateInvoice");
{
  const v = validateInvoice(GOOD_INV);
  ok(v.ok && v.errors.length === 0, "valid invoice passes");
  const bad = validateInvoice({ supplier_name: "X", parts: [] });
  ok(!bad.ok && bad.errors.some((e) => /empty/.test(e)), "empty parts array is an error");
  const coerce = validateInvoice({ ...GOOD_INV, gst_treatment: "maybe", parts: [{ ...GOOD_INV.parts[0], grade: "Genuine-ish", unit_basis: "dozen" }] });
  ok(coerce.ok && coerce.invoice.gst_treatment === "unknown" && coerce.invoice.parts[0].grade === "Unknown" && coerce.invoice.parts[0].unit_basis === "each",
     "invalid enums coerce with warnings, not errors");
  ok(coerce.warnings.length >= 3, "coercions produce warnings");
  const noPrice = validateInvoice({ ...GOOD_INV, parts: [{ part_name: "THING", part_number: "", qty: 1, unit_cost: 0, total_cost: 0 }] });
  ok(!noPrice.ok, "a line with no price at all is an error");
  ok(validateInvoice("not an object").ok === false, "non-object input rejected");
}

console.log("make canonicalisation (dashboard coverage)");
{
  ok(canonMake("Mercedes") === "Mercedes-Benz", "\"Mercedes\" folds to Mercedes-Benz");
  ok(canonMake("MERCEDES BENZ") === "Mercedes-Benz", "\"MERCEDES BENZ\" folds to Mercedes-Benz");
  ok(canonMake("mercedes-benz") === "Mercedes-Benz", "lower/punct variant folds to Mercedes-Benz");
  ok(canonMake("Merc") === "Mercedes-Benz" && canonMake("Benz") === "Mercedes-Benz", "\"Merc\"/\"Benz\" aliases fold to Mercedes-Benz");
  ok(canonMake("VW") === "Volkswagen" && canonMake("Chevy") === "Chevrolet", "VW/Chevy aliases fold");
  ok(canonMake("toyota") === "Toyota", "case-only variant folds to canonical Toyota");
  ok(canonMake("Mitsubishi") === "Mitsubishi" && canonMake("Mitsubishi Fuso") === "Mitsubishi Fuso", "Mitsubishi vs Mitsubishi Fuso stay distinct");
  ok(canonMake("Perodua") === "Perodua", "an unlisted make is returned untouched");
  ok(canonMake("") === "Unknown" && canonMake("Unknown") === "Unknown", "blank/Unknown stay Unknown");
  ok(inferMake("MBA213 906 67 01", "MERCEDES") === "Mercedes-Benz", "a supplied make is canonicalised, not trusted verbatim");
  ok(inferMake("MBA2139066701", "") === "Mercedes-Benz", "make still inferred from PN prefix when none supplied");
  ok(enrichPart({ part_name: "HEADLAMP", part_number: "X", make: "Mercedes" }).make === "Mercedes-Benz", "enrichPart canonicalises the make");
  ok(upgradePart({ part_name: "HEADLAMP", part_number: "X", make: "MERCEDES BENZ" }).make === "Mercedes-Benz", "upgradePart re-folds a persisted make on load");
}

console.log("token-lean OCR output (omitted default fields — prompt v1.8.1)");
{
  // The OCR prompt omits grade (when unmarked), unit_basis (when each) and
  // unit_cost (when not printed). Both ingest paths must treat omission
  // exactly like the old explicit defaults, with ZERO warnings.
  const lean = validateInvoice({ ...GOOD_INV, parts: [
    { part_name: "FR BUMPER COVER", part_number: "T52119-02M50", qty: 1, total_cost: 200 },
  ]});
  ok(lean.ok, "invoice with omitted grade/unit_basis/unit_cost passes validation");
  ok(lean.warnings.length === 0, "omitted default fields produce zero warnings");
  ok(lean.invoice.parts[0].grade === "Unknown" && lean.invoice.parts[0].unit_basis === "each" && lean.invoice.parts[0].unit_cost === 0,
     "omitted fields coerce to the exact old defaults (Unknown / each / 0)");
  // App live-OCR path skips validateInvoice — enrichPart must be equally safe.
  const e = enrichPart({ part_name: "FR BUMPER COVER", part_number: "T52119-02M50", qty: 2, total_cost: 400,
    supplier: "X", bill_no: "B1", bill_date: "01/02/2025", doc_type: "Tax Invoice" });
  ok(e.unit === 200, "enrichPart derives unit from total when unit_cost is omitted");
  ok(e.grade === "Unknown" && e.unit_basis === "each", "enrichPart infers defaults when grade/unit_basis are omitted");
  const noTotals = enrichPart({ part_name: "THING", part_number: "P1", qty: 1,
    supplier: "X", bill_no: "B1", bill_date: "01/02/2025", doc_type: "Tax Invoice" });
  ok(noTotals.unit === 0 && noTotals.total === 0, "omitted unit_cost with no total stays 0, never NaN");
}

console.log("extractJson");
{
  ok(extractJson('```json\n{"a":1}\n```').a === 1, "strips code fences");
  ok(extractJson('Here you go: {"a":{"b":2}} thanks').a.b === 2, "tolerates surrounding prose");
  let threw = false; try { extractJson("no json here"); } catch { threw = true; }
  ok(threw, "throws when no JSON object present");
}

console.log("reconciliation + snapshot");
{
  const rec = reconcileInvoice(GOOD_INV.parts, GOOD_INV);
  ok(rec.ok === true && rec.basis === "parts subtotal", "good invoice reconciles against parts subtotal");
  const bad = reconcileInvoice(GOOD_INV.parts.slice(0, 1), GOOD_INV);
  ok(bad.ok === false, "missing line fails reconciliation");

  ok(findDuplicateLines(GOOD_INV.parts).length === 0, "distinct lines have no duplicates");
  const dup = [GOOD_INV.parts[0], GOOD_INV.parts[0], GOOD_INV.parts[1]];
  ok(findDuplicateLines(dup).length === 1 && findDuplicateLines(dup)[0] === GOOD_INV.parts[0].part_name,
     "same part number, qty and price repeated → flagged once, by name");
  const sameNameDiffPrice = [{ part_name: "BOLT", part_number: "", qty: 1, unit_cost: 5 }, { part_name: "BOLT", part_number: "", qty: 1, unit_cost: 8 }];
  ok(findDuplicateLines(sameNameDiffPrice).length === 0, "same name but different price is not flagged as a duplicate");

  const parts = GOOD_INV.parts.map((p) => enrichPart({ ...p, supplier: GOOD_INV.supplier_name, bill_no: GOOD_INV.bill_no, bill_date: GOOD_INV.bill_date, make: "Toyota", doc_type: "Tax Invoice" }));
  const cfg = { mode: "hybrid", threshold: 0.65, sameMake: true, sameModel: false, tokenWeight: 0.6, bridge: false, sepGrade: true };
  const id1 = snapshotId(parts, cfg), id2 = snapshotId([...parts].reverse(), cfg);
  ok(id1 === id2 && /^PIX-[0-9a-f]{8}-[0-9a-f]{8}$/.test(id1), "snapshot id is order-independent and well-formed");
  ok(snapshotId(parts, { ...cfg, threshold: 0.7 }) !== id1, "config change changes the snapshot id");
  ok(snapshotId(parts.slice(0, 1), cfg) !== id1, "data change changes the snapshot id");
}

console.log("buildDisputePack");
{
  const raw = [
    { part_name: "HEADLAMP RH", part_number: "T81110-02M40", qty: 1, unit_cost: 340, total_cost: 340, supplier: "Jae Auto", bill_no: "J-1", bill_date: "01/02/2025", make: "Toyota", model: "Camry (ACV40/41)", doc_type: "Tax Invoice" },
    { part_name: "HEAD LAMP RH", part_number: "T81110-02M40", qty: 1, unit_cost: 360, total_cost: 360, supplier: "He Xing", bill_no: "H-7", bill_date: "15/04/2025", make: "Toyota", model: "Camry (ACV40/41)", doc_type: "Tax Invoice" },
  ].map(enrichPart);
  const cfg = { mode: "hybrid", threshold: 0.65, sameMake: true, sameModel: false, tokenWeight: 0.6, bridge: false, sepGrade: true };
  const clusters = buildClusters(raw, cfg);
  const c = clusters[0];
  ok(Array.isArray(c.models) && c.models[0] === "Camry (ACV40/41)" && c.modelMixed === false, "cluster carries models array and modelMixed flag");
  const rows = [
    { pn: "T81110-02M40", name: "HEADLAMP UNIT RH", quoted: 520, bench: c.med, over: +(520 - c.med).toFixed(2), overPct: 49, how: "part number", score: 1, n: c.n, flagged: true, cluster: c },
    { pn: "9999", name: "UNLISTED WIDGET", quoted: 300, bench: null, over: null, overPct: null, how: "no match", score: 0, n: 0, flagged: false, cluster: null },
  ];
  const pack = buildDisputePack(rows, cfg, { claimRef: "TP-2026-0042", generatedAt: "05/07/2026", appVersion: "1.1.0", snapshotId: "PIX-xxxxxxxx-yyyyyyyy", invoices: 2, usableLines: 2, inflPct: 30 });
  ok(pack.summary.some((r) => r.Field === "Benchmark snapshot" && r.Value === "PIX-xxxxxxxx-yyyyyyyy"), "summary carries the snapshot id");
  ok(pack.summary.find((r) => r.Field === "Potential over-claim, S$").Value === +(520 - c.med).toFixed(2), "over-claim total correct");
  ok(pack.lines.length === 2 && pack.lines[1]["Benchmark cluster"] === "no match", "unmatched line included and marked");
  ok(pack.lines[0].Make === "Toyota" && pack.lines[0].Model === "Camry (ACV40/41)", "line assessment carries make and model");
  ok(pack.evidence.length === 2 && pack.evidence.every((e) => e["Bill no"] && e.Supplier && e["Unit price S$"] > 0 && e.Make === "Toyota"), "evidence lists every underlying quote with provenance incl. make");
}

console.log("upgradePart (stale localStorage migration)");
{
  // A part as persisted by a pre-grade app version: no grade/unit_basis/gst/review fields at all.
  const stale = { id: "abc", bill_no: "8049120", supplier: "Min Ghee Auto Pte Ltd", bill_date: "28/12/2016",
    make: "Hyundai", model: "Tucson (TL/2L)", part_name: "BALL JOINT ASSY-INR L/R", part_number: "KA56540 2H 000",
    npn: "KA565402H000", cat: "Suspension/Steering Arm", qty: 1, unit: 42, total: 42, ltype: "Supplier Part", doc_type: "Tax Invoice", src: "excel" };
  const up = upgradePart(stale);
  ok(up.grade === "Unknown" && up.unit_basis === "pair" && up.gst === "unknown" && up.review === false,
     "missing fields back-filled (L/R name → per pair; grade unknown, not undefined)");
  ok(up.id === "abc" && up.npn === "KA565402H000" && up.unit === 42, "existing values untouched");
  const modern = upgradePart({ ...stale, grade: "OES", unit_basis: "each", gst: "incl", review: true, review_reason: "x" });
  ok(modern.grade === "OES" && modern.unit_basis === "each" && modern.gst === "incl" && modern.review === true, "valid present values always win");
  const noBasis = upgradePart({ ...stale, part_name: "BALL JOINT ASSY", npn: undefined, ltype: undefined });
  ok(noBasis.unit_basis === "each" && noBasis.npn === "KA565402H000" && noBasis.ltype === "Supplier Part", "plain name → per each; npn/ltype recomputed when absent");
}

console.log("batch runner helpers");
{
  const a = parseArgs(["--in", "./x", "--mode", "batch", "--limit", "5", "--price-in", "1.5"]);
  ok(a.in === "./x" && a.mode === "batch" && a.limit === 5 && a.priceIn === 1.5, "parseArgs reads flags");
  let threw = false; try { parseArgs(["--mode", "turbo"]); } catch { threw = true; }
  ok(threw, "parseArgs rejects unknown mode");
  ok(a.model === "claude-sonnet-4-6", "parseArgs default model is the tuned Sonnet 4.6 baseline");
  const aOpus = parseArgs(["--in", "./x", "--model", "claude-opus-5"]);
  ok(aOpus.model === "claude-opus-5", "parseArgs --model overrides the default (Opus 5 retry pass)");
  const req = buildRequestParams("QUJD", ".pdf", { model: "claude-sonnet-5", maxTokens: 8192 });
  ok(req.model === "claude-sonnet-5" && req.max_tokens === 8192 &&
     req.messages[0].content[0].type === "document", "buildRequestParams carries model + max_tokens into the request body");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pix-test-"));
  const jsonDir = path.join(tmp, "json"); fs.mkdirSync(jsonDir);
  const manifest = loadManifest(tmp);
  ok(manifest.files && manifest.batches, "fresh manifest has expected shape");

  const ctx = { jsonDir, seen: new Map(), outDir: tmp, manifest };
  const file = { name: "MG-1001.pdf", hash: sha256(Buffer.from("fake pdf 1")) };
  const e1 = processResult(file, JSON.stringify(GOOD_INV), { input_tokens: 1000, output_tokens: 200 }, ctx);
  ok(e1.status === "done" && e1.lines === 2 && fs.existsSync(path.join(jsonDir, e1.json)), "good invoice → done + JSON written");
  const e2 = processResult({ name: "MG-1001-copy.pdf", hash: sha256(Buffer.from("fake pdf 2")) }, JSON.stringify(GOOD_INV), null, ctx);
  ok(e2.status === "duplicate", "same supplier+bill from a second file → duplicate");
  const short = { ...GOOD_INV, bill_no: "MG-1002", parts: GOOD_INV.parts.slice(0, 1) };
  const e3 = processResult({ name: "MG-1002.pdf", hash: sha256(Buffer.from("fake pdf 3")) }, JSON.stringify(short), null, ctx);
  ok(e3.status === "review" && /reconcil|missing|misread/i.test(e3.review_reason), "reconciliation mismatch → review");
  const e4 = processResult({ name: "junk.pdf", hash: sha256(Buffer.from("fake pdf 4")) }, "the model rambled with no json", null, ctx);
  ok(e4.status === "failed" && fs.existsSync(path.join(jsonDir, `junk.${e4 && sha256(Buffer.from("fake pdf 4")).slice(0, 8)}.raw.txt`)), "unparseable → failed + raw text saved");
  const dupInv = { ...GOOD_INV, bill_no: "MG-2001", parts_subtotal: 700, invoice_total: 700,
    parts: [
      { part_name: "CLIP FASTENER", part_number: "T90467-A", qty: 1, unit_cost: 350, total_cost: 350, grade: "Unknown", unit_basis: "each" },
      { part_name: "CLIP FASTENER", part_number: "T90467-A", qty: 1, unit_cost: 350, total_cost: 350, grade: "Unknown", unit_basis: "each" },
    ] };
  const e5 = processResult({ name: "MG-2001.pdf", hash: sha256(Buffer.from("fake pdf 5")) }, JSON.stringify(dupInv), null, ctx);
  ok(e5.status === "review" && /duplicate/i.test(e5.review_reason) && !/reconcil|missing|misread/i.test(e5.review_reason),
     "reconciling totals with a repeated line → review for the duplicate alone, not a totals mismatch");

  manifest.files[file.hash] = e1;
  manifest.files[sha256(Buffer.from("fake pdf 3"))] = e3;
  manifest.files[sha256(Buffer.from("fake pdf 4"))] = e4;
  saveManifest(tmp, manifest);
  ok(loadManifest(tmp).files[file.hash].status === "done", "manifest round-trips");

  const rows = invoiceToRows(JSON.parse(fs.readFileSync(path.join(jsonDir, e1.json), "utf8")));
  ok(rows.length === 2 && rows[0]["Part Number"] === "T81110-02M40" && rows[0].Grade === "OEM Genuine" && rows[0].Review === "", "invoiceToRows emits app-importable columns");

  const { xlsxPath, partRows } = writeOutputs(tmp, manifest);
  ok(fs.existsSync(xlsxPath) && partRows === 3, "workbook written with done+review rows (2 + 1)");
  const XLSX = (await import("xlsx")).default;
  const wb = XLSX.readFile(xlsxPath);
  ok(wb.SheetNames.includes("Parts") && wb.SheetNames.includes("Run Log"), "workbook has Parts + Run Log sheets");
  const reviewRows = XLSX.utils.sheet_to_json(wb.Sheets["Parts"]).filter((r) => r.Review === "yes");
  ok(reviewRows.length === 1 && /reconcil|missing|misread/i.test(reviewRows[0]["Review Reason"] || ""), "review flag + reason survive into the Parts sheet");
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("dispersion stats (IQR / SD / CV)");
{
  const approx = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
  // R-7 / Excel PERCENTILE.INC reference values for [1..10]:
  ok(approx(quantile([1,2,3,4,5,6,7,8,9,10], 0.25), 3.25), "Q1 matches Excel PERCENTILE.INC");
  ok(approx(quantile([1,2,3,4,5,6,7,8,9,10], 0.5), 5.5), "median (p=0.5) matches");
  ok(approx(quantile([1,2,3,4,5,6,7,8,9,10], 0.75), 7.75), "Q3 matches Excel PERCENTILE.INC");
  ok(approx(quantile([42], 0.25), 42) && approx(quantile([42], 0.75), 42), "single value: all quantiles equal it");
  // Sample SD (n-1) of [2,4,4,4,5,5,7,9] is exactly 2.13809...
  ok(approx(stdev([2,4,4,4,5,5,7,9]), 2.138, 0.005), "sample stdev (n-1) matches STDEV.S");
  ok(Number.isNaN(stdev([5])), "stdev of one value is NaN, not 0");

  const d = dispersion([100, 100, 100, 200, 300]); // n=5 → reliable
  ok(d.q1 === 100 && d.q3 === 200 && d.iqr === 100, "dispersion computes IQR from quartiles");
  ok(approx(d.upperFence, 350) && approx(d.lowerFence, -50), "Tukey fences = Q ± 1.5·IQR");
  ok(d.reliable === true, "5 quotes → reliable");
  ok(Number.isFinite(d.cv) && d.cv > 0, "CV is a positive percentage when SD is defined");

  const thin = dispersion([100, 120, 140]); // n=3 → advisory
  ok(thin.reliable === false, "fewer than 4 quotes → reliable:false");

  const one = dispersion([250]);
  ok(Number.isNaN(one.sd) && Number.isNaN(one.cv) && one.reliable === false, "single quote: SD/CV NaN, not reliable");
  ok(dispersion([]) === null, "empty group → null");

  // Cluster objects carry the measures end-to-end.
  const parts = [
    { part_name: "HEADLAMP RH", part_number: "AA-1", qty: 1, unit_cost: 100, total_cost: 100, doc_type: "Tax Invoice", supplier: "S1", bill_no: "B1" },
    { part_name: "HEADLAMP RH", part_number: "AA-1", qty: 1, unit_cost: 140, total_cost: 140, doc_type: "Tax Invoice", supplier: "S2", bill_no: "B2" },
    { part_name: "HEADLAMP RH", part_number: "AA-1", qty: 1, unit_cost: 120, total_cost: 120, doc_type: "Tax Invoice", supplier: "S3", bill_no: "B3" },
    { part_name: "HEADLAMP RH", part_number: "AA-1", qty: 1, unit_cost: 130, total_cost: 130, doc_type: "Tax Invoice", supplier: "S4", bill_no: "B4" },
  ].map(enrichPart);
  const [cl] = buildClusters(parts, { mode: "exact-pn" });
  ok(cl && typeof cl.iqr === "number" && typeof cl.upperFence === "number" && cl.reliable === true,
     "makeCluster surfaces iqr / upperFence / reliable on the cluster");

  // Configurable reliability floor threads from cfg → dispersion.
  const three = parts.slice(0, 3);
  const [c4] = buildClusters(three, { mode: "exact-pn" });                 // default floor 4
  ok(c4.n === 3 && c4.reliable === false, "3 quotes with default floor (4) → not reliable");
  const [c3] = buildClusters(three, { mode: "exact-pn", minQuotes: 3 });   // floor lowered to 3
  ok(c3.n === 3 && c3.reliable === true, "3 quotes with floor lowered to 3 → reliable");
  const [c5] = buildClusters(parts, { mode: "exact-pn", minQuotes: 5 });   // floor raised to 5
  ok(c5.n === 4 && c5.reliable === false, "4 quotes with floor raised to 5 → not reliable");
}

/* ---- positional guard (P1 stopword false-merge fix) ---- */
{
  ok(posKey("COVER FR").end === "F" && posKey("COVER RR").end === "B", "posKey reads front/rear");
  ok(posKey("HEADLAMP LH").side === "L" && posKey("HEADLAMP RH").side === "R", "posKey reads LH/RH");
  ok(posKey("MIRROR LH/RH PAIR").side === "" , "a pair line (both sides) has no side → never blocks");
  ok(posKey("BUMPER COVER").side === "" && posKey("BUMPER COVER").end === "", "no positional tokens → empty key");

  ok(posConflict("COVER FR", "COVER RR") === true, "front vs rear ALWAYS conflicts");
  ok(posConflict("HEADLAMP LH", "HEADLAMP RH") === false, "LH vs RH does not conflict by default");
  ok(posConflict("HEADLAMP LH", "HEADLAMP RH", true) === true, "LH vs RH conflicts when sepSide is on");
  ok(posConflict("COVER FR", "COVER") === false, "unknown position never blocks a merge");
  ok(posConflict("BUMPER FRT", "BUMPER FRONT") === false, "spelling variants on the SAME axis still merge");
  ok(posConflict("WEATHERSTRIP HOOD", "WEATHERSTRIP HOOD FR") === false, "P1 case: FR vs unmarked does not veto (threshold decides)");
  ok(posKey("CHASSIS FRAME").end === "" , "FRAME never reads as front (standalone tokens only)");
  ok(posKey("T81110-FR2").end === "" , "FR inside a part-number fragment never reads as front");
  ok(posConflict("ARM UPR", "ARM LOWER") === true, "upper vs lower conflicts");
  ok(posConflict("BALL JOINT INR", "BALL JOINT OTR") === true, "inner vs outer conflicts");
  ok(posConflict("DOOR PANEL FRONT", "DOOR PANEL REAR") === true, "P1 case: door panel front vs rear vetoed");

  // Regression: "COVER FR" and "COVER RR" both normalise toward "cover"-ish strings once
  // stopwords are stripped; they must land in SEPARATE clusters, not one false merge.
  const posParts = [
    { part_name: "BUMPER COVER FR", part_number: "PN-F1", qty: 1, unit_cost: 400, total_cost: 400, doc_type: "Tax Invoice", supplier: "S1", bill_no: "B1", make: "Toyota" },
    { part_name: "BUMPER COVER RR", part_number: "PN-R1", qty: 1, unit_cost: 250, total_cost: 250, doc_type: "Tax Invoice", supplier: "S2", bill_no: "B2", make: "Toyota" },
  ].map(enrichPart);
  const fuz = buildClusters(posParts, { mode: "fuzzy-name", threshold: 0.65, tokenWeight: 0.6, sameMake: true });
  ok(fuz.length === 2, "fuzzy mode keeps front and rear bumper covers in separate clusters");
  const bri = buildClusters(posParts, { mode: "hybrid", bridge: true, threshold: 0.65, tokenWeight: 0.6, sameMake: true });
  ok(bri.length === 2, "hybrid name-bridging never bridges a front part onto a rear part");

  // LH/RH still pool by default (price-identical counterparts double the quotes)…
  const lrParts = [
    { part_name: "HEADLAMP LH", part_number: "PN-L", qty: 1, unit_cost: 300, total_cost: 300, doc_type: "Tax Invoice", supplier: "S1", bill_no: "B3", make: "Toyota" },
    { part_name: "HEADLAMP RH", part_number: "PN-R", qty: 1, unit_cost: 300, total_cost: 300, doc_type: "Tax Invoice", supplier: "S2", bill_no: "B4", make: "Toyota" },
  ].map(enrichPart);
  const pooled = buildClusters(lrParts, { mode: "fuzzy-name", threshold: 0.65, tokenWeight: 0.6, sameMake: true });
  ok(pooled.length === 1, "LH/RH counterparts pool into one cluster by default");
  // …and split when the adjuster opts in.
  const split = buildClusters(lrParts, { mode: "fuzzy-name", threshold: 0.65, tokenWeight: 0.6, sameMake: true, sepSide: true });
  ok(split.length === 2, "sepSide:true keeps LH and RH in separate clusters");

  // Regression (shipped bug): exact-pn keyed every part-number-less line to one shared "?" bucket,
  // pooling unrelated parts into a single high-count cluster that sorted to the top of the list.
  const noPnParts = [
    { part_name: "PASSENGER AIRBAG", part_number: "", qty: 1, unit_cost: 2340, total_cost: 2340, doc_type: "Tax Invoice", supplier: "S1", bill_no: "B5", make: "Honda" },
    { part_name: "BONNET HINGE RH", part_number: "", qty: 1, unit_cost: 25, total_cost: 25, doc_type: "Tax Invoice", supplier: "S2", bill_no: "B6", make: "Honda" },
    { part_name: "FOOTMAT STAY", part_number: "-", qty: 1, unit_cost: 60, total_cost: 60, doc_type: "Tax Invoice", supplier: "S3", bill_no: "B7", make: "Honda" },
  ].map(enrichPart);
  const exact = buildClusters(noPnParts, { mode: "exact-pn", sameMake: true });
  ok(exact.length === 3, "exact-pn keeps part-number-less lines apart instead of pooling them");
  ok(exact.every((c) => c.n === 1), "each part-number-less line stands alone, so no bogus multi-quote median");
  ok(exact.every((c) => c.pns.length === 0), "a part-number-less cluster carries no part number to match on");
}

/* ---- categorise: a component must beat the assembly it is named against ----
   Real names from the live dataset. Matching the assembly first put a S$2 clip, a S$55 grille and
   a S$600 bumper face in one "Front Bumper" median spanning 300×. */
{
  const cat = (name, want) => ok(categorise(name) === want, `"${name}" → ${want}` + (categorise(name) === want ? "" : ` (got ${categorise(name)})`));
  // The bumper family: only the bumper itself stays in Front Bumper.
  cat("Front Bumper", "Front Bumper");
  cat("Face, FR Bumper", "Front Bumper");
  cat("Grille, FR Bumper", "Grille");
  cat("FRT BUMPER GRILLE LH", "Grille");            // component named LAST, not first
  cat("Garnish, FR Bumper, CTR", "Garnish/Trim");
  cat("Rein, FR Bumper, UPR", "Bumper Reinforcement");
  cat("Clip, FR Bumper", "Consumable/Fastener");
  cat("FR BUMPER CLIP", "Consumable/Fastener");
  cat("FRT BUMPER SPONGE", "Bumper Bracket/Retainer");
  // A belt is a restraint, not furniture; an airbag is not a generic electronic module…
  cat("Front Seat Belt RH", "Seat Belt");
  cat("Passenger Airbag", "Airbag");
  cat("Airbag Control Module", "Electronic Module"); // …but its CONTROL UNIT still is
  // Written in either word order.
  cat("Bonnet Hinge RH", "Hood/Bonnet Hinge");
  cat("HINGE, BONNET RH", "Hood/Bonnet Hinge");
  cat("BONNET LOCK BKT", "Lock/Mechanism");
  // Promoting Consumable/Fastener above the assemblies must not let " mark " eat a marker lamp.
  cat("Lamp Assy, Side Marker, LH", "Signal/Marker Lamp");
  // Assemblies still resolve normally.
  cat("FR Fender LH", "Fender");
  cat("Headlamp Assy LH", "Headlamp");
  cat("Front Door LH", "Door Panel");

  // A stored part must pick up an improved rule without a re-import: upgradePart RECOMPUTES cat,
  // and ltype with it, so a clip stored as a bumper leaves the benchmark population.
  const stale = upgradePart({ part_name: "Clip, FR Bumper", part_number: "", cat: "Front Bumper", ltype: "Supplier Part", doc_type: "Tax Invoice", qty: 1, unit: 2, total: 2 });
  ok(stale.cat === "Consumable/Fastener", "upgradePart re-derives a stale stored category");
  ok(stale.ltype === "Consumable / Fastener", "…and the line type that follows from it, so the clip drops out of the benchmark");
}

/* ---- benchmark recency window (cfg.maxAgeYears) ---- */
{
  const yr = (y) => `01/06/${y}`;
  const now = new Date().getFullYear();
  const dated = [
    { part_name: "HEADLAMP", part_number: "PN-1", qty: 1, unit_cost: 300, total_cost: 300, doc_type: "Tax Invoice", supplier: "S1", bill_no: "B1", bill_date: yr(now - 1), make: "Toyota" },
    { part_name: "HEADLAMP", part_number: "PN-1", qty: 1, unit_cost: 900, total_cost: 900, doc_type: "Tax Invoice", supplier: "S2", bill_no: "B2", bill_date: yr(now - 8), make: "Toyota" },
  ].map(enrichPart);
  const all = buildClusters(dated, { mode: "exact-pn", sameMake: true });
  ok(all[0].n === 2, "no window set: every bill feeds the benchmark");
  const recent = buildClusters(dated, { mode: "exact-pn", sameMake: true, maxAgeYears: 3 });
  ok(recent[0].n === 1 && recent[0].med === 300, "a 3-year window drops the 8-year-old bill from the median");
  const wide = buildClusters(dated, { mode: "exact-pn", sameMake: true, maxAgeYears: 10 });
  ok(wide[0].n === 2, "a 10-year window keeps both");
  // An undated bill is not KNOWN to be old — dropping it would silently shrink the reference.
  const undated = [{ part_name: "GRILLE", part_number: "PN-2", qty: 1, unit_cost: 100, total_cost: 100, doc_type: "Tax Invoice", supplier: "S1", bill_no: "B3", make: "Toyota" }].map(enrichPart);
  ok(buildClusters(undated, { mode: "exact-pn", maxAgeYears: 2 })[0].n === 1, "a bill with no printed date survives the window");
}

/* ---- parseDate accepts both bill and ISO forms ---- */
{
  const a = parseDate("15/1/26");
  ok(a && a.getFullYear() === 2026 && a.getMonth() === 0 && a.getDate() === 15, "parseDate reads D/M/YY");
  const b = parseDate("2026-01-15");
  ok(b && b.getFullYear() === 2026 && b.getMonth() === 0 && b.getDate() === 15, "parseDate reads ISO YYYY-MM-DD");
  ok(parseDate("no date here") === null, "parseDate returns null for garbage");
}

console.log("decideInit — first-load seed decision (auto-seed guard)");
{
  const populated = { parts: [{ part_name: "X" }] };
  const empty = { parts: [] };
  // A real dataset always wins, on either backend.
  ok(decideInit({ isShared: false, stored: populated, seededBefore: false }) === "use-stored", "local: a stored dataset is used, never reseeded");
  ok(decideInit({ isShared: true, stored: populated, seededBefore: false }) === "use-stored", "shared: a stored dataset is used");
  // An empty-but-PRESENT dataset ({parts:[]}) is real state (e.g. after Clear) — use it, don't seed.
  ok(decideInit({ isShared: false, stored: empty, seededBefore: false }) === "use-stored", "local: an explicitly-empty dataset is honoured (Clear is not a reseed trigger)");
  // Shared backend never auto-seeds, marker or not.
  ok(decideInit({ isShared: true, stored: null, seededBefore: false }) === "empty-shared", "shared: empty DB starts empty, never auto-seeds");
  ok(decideInit({ isShared: true, stored: null, seededBefore: true }) === "empty-shared", "shared: marker is irrelevant to the shared backend");
  // The whole point: local build, no dataset key, but this browser has held data → do NOT reseed.
  ok(decideInit({ isShared: false, stored: null, seededBefore: true }) === "empty-returning", "local: a returning browser with a lost dataset starts EMPTY, not reseeded");
  // Genuine first run: no dataset, no marker → seed once.
  ok(decideInit({ isShared: false, stored: null, seededBefore: false }) === "seed-first-run", "local: a genuine first run seeds the demo");
  // Malformed stored shape (no parts array) is treated as absent, so the marker still guards it.
  ok(decideInit({ isShared: false, stored: { parts: "oops" }, seededBefore: true }) === "empty-returning", "local: a malformed stored blob falls through to the marker guard");
  ok(decideInit({ isShared: false, stored: {}, seededBefore: false }) === "seed-first-run", "local: a malformed stored blob on a fresh browser still seeds");
}

/* ---- make recovery from the filing convention <date>-<insurer>-<MAKE>-<n> ----
   Supplier bills often don't print the vehicle make at all, so the filename is
   the only record of it. This must recover the make WITHOUT ever overriding one
   the OCR actually read off the page. ---- */
console.log("makeFromFilename — recovering the make a bill never printed");
{
  ok(makeFromFilename("2025-05-20-Allianz Insurance Singapore Pte. Ltd.-TOYOTA-1.PDF") === "Toyota",
     "reads the make segment and canonicalises it");
  // The one make whose own name contains a dash — the walk must take both segments.
  ok(makeFromFilename("2025-08-17-Allianz Insurance Singapore Pte. Ltd.-MERCEDES-BENZ-10.JPG") === "Mercedes-Benz",
     "MERCEDES-BENZ spans two segments and still resolves to one make");
  // Insurer names are mixed case, so the right-to-left walk stops at them. If it
  // didn't, "Ltd." would be swept into the make.
  ok(makeFromFilename("2025-08-29-HL Assurance Pte Ltd-NISSAN-17.PDF") === "Nissan",
     "the walk stops at the mixed-case insurer");
  // Marques that only reached CANON_MAKES via the scanned corpus.
  ok(makeFromFilename("2025-09-18-AIG-SKODA-22.PDF") === "Skoda", "SKODA canonicalises rather than staying shouty");
  ok(makeFromFilename("2025-09-18-AIG-BYD-22.PDF") === "BYD", "BYD is an acronym and keeps its case");
  // Anything off-convention yields nothing rather than a guess.
  ok(makeFromFilename("scan0012.pdf") === "", "an off-convention filename yields no make, not a guess");
  ok(makeFromFilename("2025-05-20-Some Insurer-1.PDF") === "", "a filename with no make segment yields nothing");
  ok(makeFromFilename("") === "", "an empty filename yields nothing");
}

console.log("processResult — filename make is a FALLBACK, never an override");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-make-"));
  const ctx = { jsonDir: dir, seen: new Map() };
  const read = (n) => JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"));

  // The page said Toyota; the filename says Honda. The page is the evidence.
  const a = processResult({ name: "2025-01-01-Insurer Pte Ltd-HONDA-1.PDF", hash: "a".repeat(64) },
    JSON.stringify(GOOD_INV), null, ctx);
  ok(read(a.json).make === "Toyota" && read(a.json)._make_source === "ocr",
     "an OCR-captured make wins over the filename");

  // The page printed no make at all — this is the 1-in-3 case the fallback exists for.
  const blank = { ...GOOD_INV, bill_no: "MG-1002", make: "" };
  const b = processResult({ name: "2025-01-01-Insurer Pte Ltd-HONDA-2.PDF", hash: "b".repeat(64) },
    JSON.stringify(blank), null, ctx);
  ok(read(b.json).make === "Honda" && read(b.json)._make_source === "filename",
     "a blank make falls back to the filename, tagged as such");

  // "Unknown" is what validateInvoice leaves for a missing make — treat it as blank.
  const unk = { ...GOOD_INV, bill_no: "MG-1003", make: "Unknown" };
  const c = processResult({ name: "2025-01-01-Insurer Pte Ltd-KIA-3.PDF", hash: "c".repeat(64) },
    JSON.stringify(unk), null, ctx);
  ok(read(c.json).make === "Kia", '"Unknown" counts as no make and takes the fallback');

  // Neither source has one: don't invent a make.
  const d = processResult({ name: "scan0044.pdf", hash: "d".repeat(64) },
    JSON.stringify({ ...GOOD_INV, bill_no: "MG-1004", make: "" }), null, ctx);
  ok(read(d.json)._make_source === "none", "no make anywhere leaves it unset rather than guessed");

  // Variant spellings fold onto one marque, or the same car clusters twice.
  const e = processResult({ name: "2025-01-01-Insurer Pte Ltd-BMW-5.PDF", hash: "e".repeat(64) },
    JSON.stringify({ ...GOOD_INV, bill_no: "MG-1005", make: "MERCEDES BENZ" }), null, ctx);
  ok(read(e.json).make === "Mercedes-Benz", "an OCR make is canonicalised too, not just the fallback");

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log("backfill-make — rewriting makes already in the reference");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-bf-"));
  const put = (n, o) => fs.writeFileSync(path.join(dir, n), JSON.stringify(o));
  put("1.json", { supplier_name: "Min Ghee", bill_no: "MG-1", make: "", _source_file: "2025-01-01-Insurer Pte Ltd-KIA-1.PDF" });
  put("2.json", { supplier_name: "Min Ghee", bill_no: "MG-2", make: "Toyota", _source_file: "2025-01-01-Insurer Pte Ltd-HONDA-2.PDF" });
  put("3.json", { supplier_name: "Min Ghee", bill_no: "", make: "Mazda", _source_file: "2025-01-01-Insurer Pte Ltd-MAZDA-3.PDF" });
  put("notes.txt", {});

  const { index, stats } = buildMakeIndex(dir);
  ok(stats.files === 3 && index.size === 2, "non-JSON files are skipped; an invoice with no bill no has no join key");
  ok(stats.noKey === 1 && stats.fromOcr === 1 && stats.fromFilename === 1, "index reports where each make came from");
  ok(index.get("min ghee|mg-2").make === "Toyota", "the OCR make survives into the index, not the filename's Honda");

  // Case and stray whitespace must not break the join — the DB's stored supplier
  // string is whatever the OCR read, and it is not normalised on write.
  ok(planRow({ id: "x", supplier: " MIN GHEE ", bill_no: "mg-1", make: "Unknown" }, index, {}).to === "Kia",
     "the supplier + bill no join is case- and whitespace-insensitive");
  ok(planRow({ id: "x", supplier: "Min Ghee", bill_no: "MG-2", make: "Nissan" }, index, {}) === null,
     "a row that already has a make is left alone");
  ok(planRow({ id: "x", supplier: "Nobody", bill_no: "ZZ-9", make: "" }, index, {}) === null,
     "an unmatched row is left blank rather than guessed at");
  // --canon is opt-in: without it, an odd spelling is not touched.
  ok(planRow({ id: "x", supplier: "Min Ghee", bill_no: "MG-2", make: "Mercedes" }, index, {}) === null,
     "canonicalisation stays off unless asked for");
  ok(planRow({ id: "x", supplier: "Min Ghee", bill_no: "MG-2", make: "Mercedes" }, index, { canon: true }).to === "Mercedes-Benz",
     "--canon folds a variant spelling onto the canonical make");
  ok(planRow({ id: "x", supplier: "Min Ghee", bill_no: "MG-2", make: "Toyota" }, index, { canon: true }) === null,
     "--canon proposes no change for a make already canonical");

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll self-tests passed.");
process.exit(failures ? 1 : 0);

