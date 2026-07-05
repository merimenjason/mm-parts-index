/* Self-test for the batch runner and dispute-pack plumbing — no API calls.
   Run: npm run test:tools  (exits non-zero on any failure) */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { validateInvoice, reconcileInvoice, snapshotId, buildDisputePack, enrichPart, buildClusters } from "../src/pipeline.js";
import { parseArgs, extractJson, dedupKey, processResult, loadManifest, saveManifest, invoiceToRows, writeOutputs, sha256 } from "./batch-ocr.mjs";

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
    { part_name: "HEADLAMP RH", part_number: "T81110-02M40", qty: 1, unit_cost: 340, total_cost: 340, supplier: "Jae Auto", bill_no: "J-1", bill_date: "01/02/2025", make: "Toyota", doc_type: "Tax Invoice" },
    { part_name: "HEAD LAMP RH", part_number: "T81110-02M40", qty: 1, unit_cost: 360, total_cost: 360, supplier: "He Xing", bill_no: "H-7", bill_date: "15/04/2025", make: "Toyota", doc_type: "Tax Invoice" },
  ].map(enrichPart);
  const cfg = { mode: "hybrid", threshold: 0.65, sameMake: true, sameModel: false, tokenWeight: 0.6, bridge: false, sepGrade: true };
  const clusters = buildClusters(raw, cfg);
  const c = clusters[0];
  const rows = [
    { pn: "T81110-02M40", name: "HEADLAMP UNIT RH", quoted: 520, bench: c.med, over: +(520 - c.med).toFixed(2), overPct: 49, how: "part number", score: 1, n: c.n, flagged: true, cluster: c },
    { pn: "9999", name: "UNLISTED WIDGET", quoted: 300, bench: null, over: null, overPct: null, how: "no match", score: 0, n: 0, flagged: false, cluster: null },
  ];
  const pack = buildDisputePack(rows, cfg, { claimRef: "TP-2026-0042", generatedAt: "05/07/2026", appVersion: "1.1.0", snapshotId: "PIX-xxxxxxxx-yyyyyyyy", invoices: 2, usableLines: 2, inflPct: 30 });
  ok(pack.summary.some((r) => r.Field === "Benchmark snapshot" && r.Value === "PIX-xxxxxxxx-yyyyyyyy"), "summary carries the snapshot id");
  ok(pack.summary.find((r) => r.Field === "Potential over-claim, S$").Value === +(520 - c.med).toFixed(2), "over-claim total correct");
  ok(pack.lines.length === 2 && pack.lines[1]["Benchmark cluster"] === "no match", "unmatched line included and marked");
  ok(pack.evidence.length === 2 && pack.evidence.every((e) => e["Bill no"] && e.Supplier && e["Unit price S$"] > 0), "evidence lists every underlying quote with provenance");
}

console.log("batch runner helpers");
{
  const a = parseArgs(["--in", "./x", "--mode", "batch", "--limit", "5", "--price-in", "1.5"]);
  ok(a.in === "./x" && a.mode === "batch" && a.limit === 5 && a.priceIn === 1.5, "parseArgs reads flags");
  let threw = false; try { parseArgs(["--mode", "turbo"]); } catch { threw = true; }
  ok(threw, "parseArgs rejects unknown mode");

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

console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll self-tests passed.");
process.exit(failures ? 1 : 0);
