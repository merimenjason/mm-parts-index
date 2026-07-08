#!/usr/bin/env node
/* ============================================================================
   PartsIndex bulk OCR runner — built for the 200-invoice run (and beyond).

   Walks a folder of supplier-bill PDFs/images, OCRs each through the Claude
   API using the SAME tuned prompt as the app (src/ocrPrompt.js), validates
   every response against the schema (src/pipeline.js → validateInvoice),
   runs the totals-reconciliation gate, dedupes on supplier+bill number, and
   emits one Excel workbook ready for the app's "Bulk upload" button.

   Safe to re-run: a manifest keyed on file SHA-256 records every outcome, so
   completed files are skipped and a crashed run resumes where it stopped.

   Usage:
     export ANTHROPIC_API_KEY=sk-ant-...
     node tools/batch-ocr.mjs --in ./invoices                    # live, 2 at a time
     node tools/batch-ocr.mjs --in ./invoices --mode batch       # Message Batches API (50% cost, ≤24 h)
     node tools/batch-ocr.mjs --in ./invoices --limit 5          # trial run on 5 files
     node tools/batch-ocr.mjs --in ./invoices --dry-run          # show the plan, no API calls
     node tools/batch-ocr.mjs --in ./invoices --retry-failed     # reprocess previous failures

   Options:
     --in <dir>          input folder of .pdf/.png/.jpg/.jpeg/.webp/.gif   (required)
     --out <dir>         output folder (default ./ocr_out)
     --mode live|batch   live = immediate calls; batch = Message Batches API (default live)
     --concurrency <n>   parallel live calls (default 2)
     --model <id>        model (default claude-sonnet-4-6)
     --max-tokens <n>    max output tokens per invoice (default 4000)
     --poll <sec>        batch-mode poll interval (default 30)
     --limit <n>         process at most n new files (trial runs)
     --retry-failed      re-attempt files whose last run failed
     --dry-run           list what would be processed, then exit
     --price-in <usd>    optional $/MTok input  — enables a cost estimate
     --price-out <usd>   optional $/MTok output — use batch rates in batch mode

   Outputs (under --out):
     manifest.json               resume state — one entry per file hash
     json/<file>.<hash8>.json    validated invoice JSON, one per document
     PartsIndex_import.xlsx      Parts sheet (app-importable) + Run Log sheet
     run_report.json             machine-readable summary of the whole run
   ============================================================================ */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import XLSX from "xlsx";
import { OCR_SYS, OCR_USER_TEXT } from "../src/ocrPrompt.js";
import { validateInvoice, reconcileInvoice } from "../src/pipeline.js";

const API = process.env.PARTSINDEX_API_BASE || "https://api.anthropic.com/v1"; // override for tests only
const API_VERSION = "2023-06-01";
const MAX_FILE_BYTES = 28 * 1024 * 1024;   // stay under the 32 MB request cap with base64 overhead
const MAX_BATCH_BYTES = 180 * 1024 * 1024; // chunk Message Batches well under the 256 MB batch cap
const MEDIA = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

/* ------------------------------- utilities ------------------------------- */
export function parseArgs(argv) {
  const a = { mode: "live", out: "./ocr_out", concurrency: 2, model: "claude-sonnet-4-6", maxTokens: 8192, poll: 30, limit: Infinity, retryFailed: false, dryRun: false, priceIn: 0, priceOut: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--in") { a.in = v; i++; }
    else if (k === "--out") { a.out = v; i++; }
    else if (k === "--mode") { a.mode = v; i++; }
    else if (k === "--concurrency") { a.concurrency = Math.max(1, +v || 2); i++; }
    else if (k === "--model") { a.model = v; i++; }
    else if (k === "--max-tokens") { a.maxTokens = +v || 8192; i++; }
    else if (k === "--poll") { a.poll = Math.max(5, +v || 30); i++; }
    else if (k === "--limit") { a.limit = +v || Infinity; i++; }
    else if (k === "--retry-failed") a.retryFailed = true;
    else if (k === "--dry-run") a.dryRun = true;
    else if (k === "--price-in") { a.priceIn = +v || 0; i++; }
    else if (k === "--price-out") { a.priceOut = +v || 0; i++; }
    else if (k === "--help" || k === "-h") a.help = true;
  }
  if (!["live", "batch"].includes(a.mode)) throw new Error(`--mode must be live or batch, got "${a.mode}"`);
  return a;
}
export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export const dedupKey = (inv) => `${(inv.supplier_name || "").trim().toLowerCase()}|${(inv.bill_no || "").trim().toLowerCase()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const log = (...m) => console.log(new Date().toTimeString().slice(0, 8), ...m);

/* Pull the JSON object out of a model response — tolerates stray prose or fences. */
export function extractJson(text) {
  const clean = String(text).replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("no JSON object found in the response");
  return JSON.parse(clean.slice(s, e + 1));
}

/* The exact request body the app's live-OCR path sends — one source of truth for the prompt. */
export function buildRequestParams(b64, ext, opts) {
  const mediaType = MEDIA[ext];
  const docBlock = ext === ".pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } };
  return {
    model: opts.model, max_tokens: opts.maxTokens, system: OCR_SYS,
    messages: [{ role: "user", content: [docBlock, { type: "text", text: OCR_USER_TEXT }] }],
  };
}

/* -------------------------------- manifest -------------------------------- */
export function loadManifest(outDir) {
  const p = path.join(outDir, "manifest.json");
  if (!fs.existsSync(p)) return { files: {}, batches: [] };
  try { const m = JSON.parse(fs.readFileSync(p, "utf8")); return { files: m.files || {}, batches: m.batches || [] }; }
  catch { throw new Error(`manifest.json exists but is unreadable — fix or delete ${p}`); }
}
export function saveManifest(outDir, m) {
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(m, null, 2));
}

/* -------------------- shared per-invoice result handling -------------------- */
/* Takes the raw model text for one file → validate → reconcile → dedupe.
   Returns the manifest entry; writes the invoice JSON on success/review. */
export function processResult(file, rawText, usage, ctx) {
  const base = { name: file.name, at: now(), usage: usage || null };
  let parsed;
  try { parsed = extractJson(rawText); }
  catch (err) {
    fs.writeFileSync(path.join(ctx.jsonDir, `${safeName(file.name)}.${file.hash.slice(0, 8)}.raw.txt`), String(rawText));
    return { ...base, status: "failed", error: `unparseable response: ${err.message} (raw text saved)` };
  }
  const v = validateInvoice(parsed);
  if (!v.ok) return { ...base, status: "failed", error: `schema validation failed: ${v.errors.join("; ")}`, warnings: v.warnings };
  const inv = v.invoice;

  const key = dedupKey(inv);
  if (inv.bill_no && ctx.seen.has(key)) {
    return { ...base, status: "duplicate", supplier: inv.supplier_name, bill_no: inv.bill_no,
      error: `bill ${inv.bill_no} from ${inv.supplier_name} already extracted (${ctx.seen.get(key)})` };
  }

  const rec = reconcileInvoice(inv.parts, inv);
  const review = rec.ok === false;
  const reason = review ? `extracted lines sum S$${rec.sum} but printed ${rec.basis} is S$${rec.stated} (diff S$${rec.diff}) — lines may be missing or misread` : "";

  const jsonName = `${safeName(file.name)}.${file.hash.slice(0, 8)}.json`;
  fs.writeFileSync(path.join(ctx.jsonDir, jsonName), JSON.stringify({ ...inv, _review: review, _review_reason: reason, _source_file: file.name, _sha256: file.hash }, null, 2));
  if (inv.bill_no) ctx.seen.set(key, file.name);

  return { ...base, status: review ? "review" : "done", json: jsonName,
    supplier: inv.supplier_name, bill_no: inv.bill_no, bill_date: inv.bill_date, doc_type: inv.doc_type,
    lines: inv.parts.length, warnings: v.warnings, reconcile: rec, review_reason: reason };
}
const safeName = (n) => n.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 60);

/* ------------------------- live mode: direct calls ------------------------- */
async function callMessages(params, apiKey) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": API_VERSION },
        body: JSON.stringify(params),
      });
      if (res.ok) return await res.json();
      const body = await res.text();
      if ([429, 500, 502, 503, 504, 529].includes(res.status) && attempt < 4) {
        const ra = +res.headers.get("retry-after") || 0;
        const wait = Math.max(ra * 1000, 2000 * 2 ** (attempt - 1)) + Math.random() * 1000;
        log(`  retryable ${res.status} — waiting ${(wait / 1000).toFixed(0)}s (attempt ${attempt}/4)`);
        await sleep(wait); continue;
      }
      throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
    } catch (err) {
      lastErr = err;
      if (attempt < 4 && /fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(String(err))) { await sleep(2000 * 2 ** (attempt - 1)); continue; }
      throw err;
    }
  }
  throw lastErr;
}

async function runLive(files, ctx, opts) {
  const queue = [...files];
  const workers = Array.from({ length: Math.min(opts.concurrency, queue.length) }, async () => {
    while (queue.length) {
      const file = queue.shift();
      log(`OCR ${file.name} (${(file.size / 1024).toFixed(0)} KB)…`);
      let entry;
      try {
        const b64 = fs.readFileSync(file.path).toString("base64");
        const data = await callMessages(buildRequestParams(b64, file.ext, opts), ctx.apiKey);
        if (data.stop_reason === "max_tokens") throw new Error(`output truncated at max_tokens=${opts.maxTokens} — re-run this file with a higher --max-tokens`);
        const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
        entry = processResult(file, text, data.usage, ctx);
      } catch (err) {
        entry = { name: file.name, at: now(), status: "failed", error: String(err.message || err) };
      }
      ctx.manifest.files[file.hash] = entry;
      saveManifest(ctx.outDir, ctx.manifest);
      log(`  → ${entry.status}${entry.error ? ": " + entry.error : entry.status === "review" ? ": " + entry.review_reason : ` (${entry.lines} lines, bill ${entry.bill_no || "?"})`}`);
    }
  });
  await Promise.all(workers);
}

/* -------------------- batch mode: Message Batches API -------------------- */
/* 50% of standard token pricing; most batches finish well within an hour,
   worst case 24 h. The manifest records pending batch ids, so a re-run of
   this script resumes polling instead of resubmitting. */
async function submitBatches(files, ctx, opts) {
  let group = [], groupBytes = 0;
  const groups = [];
  for (const f of files) {
    const b64len = Math.ceil(f.size / 3) * 4;
    if (group.length && groupBytes + b64len > MAX_BATCH_BYTES) { groups.push(group); group = []; groupBytes = 0; }
    group.push(f); groupBytes += b64len;
  }
  if (group.length) groups.push(group);

  for (const g of groups) {
    const items = {};
    const requests = g.map((f) => {
      const cid = f.hash.slice(0, 32);
      items[cid] = f.hash;
      const b64 = fs.readFileSync(f.path).toString("base64");
      return { custom_id: cid, params: buildRequestParams(b64, f.ext, opts) };
    });
    const res = await fetch(`${API}/messages/batches`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ctx.apiKey, "anthropic-version": API_VERSION },
      body: JSON.stringify({ requests }),
    });
    if (!res.ok) throw new Error(`batch create failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const batch = await res.json();
    ctx.manifest.batches.push({ id: batch.id, status: "pending", created: now(), items });
    for (const f of g) ctx.manifest.files[f.hash] = { name: f.name, at: now(), status: "submitted", batch: batch.id };
    saveManifest(ctx.outDir, ctx.manifest);
    log(`submitted batch ${batch.id} — ${g.length} invoice(s)`);
  }
}

async function pollBatches(ctx, opts) {
  const nameByHash = {};
  // file metadata needed when results arrive (name/size may not be re-scanned on resume)
  for (const [hash, e] of Object.entries(ctx.manifest.files)) nameByHash[hash] = e.name;

  for (const b of ctx.manifest.batches.filter((x) => x.status === "pending")) {
    log(`polling batch ${b.id} every ${opts.poll}s…`);
    let info;
    for (;;) {
      const res = await fetch(`${API}/messages/batches/${b.id}`, { headers: { "x-api-key": ctx.apiKey, "anthropic-version": API_VERSION } });
      if (!res.ok) throw new Error(`batch poll failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
      info = await res.json();
      const c = info.request_counts || {};
      log(`  ${info.processing_status} — ok:${c.succeeded ?? 0} err:${c.errored ?? 0} processing:${c.processing ?? 0}`);
      if (info.processing_status === "ended") break;
      await sleep(opts.poll * 1000);
    }
    const rres = await fetch(info.results_url, { headers: { "x-api-key": ctx.apiKey, "anthropic-version": API_VERSION } });
    if (!rres.ok) throw new Error(`results fetch failed ${rres.status}`);
    const linesText = await rres.text();
    for (const line of linesText.split("\n").filter(Boolean)) {
      const r = JSON.parse(line);
      const hash = b.items[r.custom_id];
      if (!hash) continue;
      const file = { name: nameByHash[hash] || r.custom_id, hash };
      let entry;
      if (r.result?.type === "succeeded") {
        const msg = r.result.message;
        if (msg.stop_reason === "max_tokens") {
          entry = { name: file.name, at: now(), status: "failed", error: "output truncated at max_tokens — retry with a higher --max-tokens" };
        } else {
        const text = (msg.content || []).filter((x) => x.type === "text").map((x) => x.text).join("\n");
        entry = processResult(file, text, msg.usage, ctx);
        }
      } else {
        entry = { name: file.name, at: now(), status: "failed", error: `batch result: ${r.result?.type}${r.result?.error ? " — " + JSON.stringify(r.result.error).slice(0, 200) : ""}` };
      }
      ctx.manifest.files[hash] = entry;
      log(`  ${file.name} → ${entry.status}${entry.error ? ": " + entry.error : ""}`);
    }
    b.status = "done"; b.ended = now();
    saveManifest(ctx.outDir, ctx.manifest);
  }
}

/* ------------------------------ final outputs ------------------------------ */
export function invoiceToRows(inv) {
  return (inv.parts || []).map((p) => ({
    "Supplier": inv.supplier_name, "Bill No": inv.bill_no, "Bill Date": inv.bill_date,
    "Make": inv.make || "", "Model": inv.model || "", "Doc Type": inv.doc_type,
    "Part Name": p.part_name, "Part Number": p.part_number, "Qty": p.qty,
    "Unit Cost": p.unit_cost || "", "Total Cost": p.total_cost,
    "Grade": p.grade, "Unit Basis": p.unit_basis, "GST": inv.gst_treatment,
    "Review": inv._review ? "yes" : "", "Review Reason": inv._review_reason || "",
  }));
}
export function writeOutputs(outDir, manifest) {
  const jsonDir = path.join(outDir, "json");
  const rows = [];
  for (const e of Object.values(manifest.files)) {
    if (!["done", "review"].includes(e.status) || !e.json) continue;
    const p = path.join(jsonDir, e.json);
    if (!fs.existsSync(p)) continue;
    rows.push(...invoiceToRows(JSON.parse(fs.readFileSync(p, "utf8"))));
  }
  const runLog = Object.entries(manifest.files).map(([hash, e]) => ({
    "File": e.name, "Status": e.status, "Supplier": e.supplier || "", "Bill No": e.bill_no || "",
    "Lines": e.lines ?? "", "Reconciliation": e.reconcile ? (e.reconcile.ok === null ? "nothing printed to check" : e.reconcile.ok ? "ok" : "MISMATCH") : "",
    "Detail": e.error || e.review_reason || (e.warnings || []).join("; "),
    "Input tokens": e.usage?.input_tokens ?? "", "Output tokens": e.usage?.output_tokens ?? "", "SHA-256": hash.slice(0, 12),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Parts");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(runLog), "Run Log");
  const xlsxPath = path.join(outDir, "PartsIndex_import.xlsx");
  fs.writeFileSync(xlsxPath, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  return { xlsxPath, partRows: rows.length };
}

/* ---------------------------------- main ---------------------------------- */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.in) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("=== */")[0].replace(/^\/\* =+\n/, "") + "=== */");
    process.exit(opts.help ? 0 : 1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !opts.dryRun) { console.error("ANTHROPIC_API_KEY is not set. export ANTHROPIC_API_KEY=sk-ant-…"); process.exit(1); }

  const outDir = path.resolve(opts.out);
  const jsonDir = path.join(outDir, "json");
  fs.mkdirSync(jsonDir, { recursive: true });
  const manifest = loadManifest(outDir);

  // scan + hash the input folder
  const all = fs.readdirSync(opts.in)
    .filter((n) => MEDIA[path.extname(n).toLowerCase()])
    .map((n) => { const p = path.join(opts.in, n); const buf = fs.readFileSync(p);
      return { name: n, path: p, ext: path.extname(n).toLowerCase(), size: buf.length, hash: sha256(buf) }; })
    .sort((a, b) => a.name.localeCompare(b.name));

  const skip = [], todo = [];
  for (const f of all) {
    const prev = manifest.files[f.hash];
    if (f.size > MAX_FILE_BYTES) { manifest.files[f.hash] = { name: f.name, at: now(), status: "failed", error: `file is ${(f.size / 1e6).toFixed(1)} MB — over the request cap; split the PDF and retry` }; skip.push([f.name, "too large"]); continue; }
    if (prev && prev.status === "submitted") { skip.push([f.name, `in pending batch ${prev.batch}`]); continue; }
    if (prev && ["done", "review", "duplicate"].includes(prev.status)) { skip.push([f.name, `already ${prev.status}`]); continue; }
    if (prev && prev.status === "failed" && !opts.retryFailed) { skip.push([f.name, "failed previously (use --retry-failed)"]); continue; }
    todo.push(f);
  }
  const limited = todo.slice(0, opts.limit);
  const pendingBatches = manifest.batches.filter((b) => b.status === "pending").length;

  log(`${all.length} file(s) found · ${skip.length} skipped · ${limited.length} to process${todo.length > limited.length ? ` (limited from ${todo.length})` : ""}${pendingBatches ? ` · ${pendingBatches} pending batch(es) to poll` : ""}`);
  for (const [n, why] of skip) log(`  skip ${n} — ${why}`);
  if (opts.dryRun) { log("dry run — no API calls made."); return; }

  // dedup ledger seeded from everything already extracted in previous runs
  const seen = new Map();
  for (const e of Object.values(manifest.files))
    if (["done", "review"].includes(e.status) && e.bill_no)
      seen.set(`${(e.supplier || "").trim().toLowerCase()}|${(e.bill_no || "").trim().toLowerCase()}`, e.name);

  const ctx = { apiKey, outDir, jsonDir, manifest, seen };

  if (opts.mode === "batch") {
    if (limited.length) await submitBatches(limited, ctx, opts);
    await pollBatches(ctx, opts);
  } else {
    await runLive(limited, ctx, opts);
  }

  // outputs + summary
  const { xlsxPath, partRows } = writeOutputs(outDir, manifest);
  const entries = Object.values(manifest.files);
  const count = (s) => entries.filter((e) => e.status === s).length;
  const tokIn = entries.reduce((s, e) => s + (e.usage?.input_tokens || 0), 0);
  const tokOut = entries.reduce((s, e) => s + (e.usage?.output_tokens || 0), 0);
  const report = {
    at: now(), input_dir: path.resolve(opts.in), mode: opts.mode, model: opts.model,
    files_total: entries.length, done: count("done"), review: count("review"),
    duplicate: count("duplicate"), failed: count("failed"), pending_in_batches: count("submitted"),
    part_rows_exported: partRows, tokens: { input: tokIn, output: tokOut },
    estimated_cost_usd: opts.priceIn || opts.priceOut ? +((tokIn / 1e6) * opts.priceIn + (tokOut / 1e6) * opts.priceOut).toFixed(2) : null,
  };
  fs.writeFileSync(path.join(outDir, "run_report.json"), JSON.stringify(report, null, 2));

  console.log("\n================ RUN SUMMARY ================");
  console.log(`  done: ${report.done}   review: ${report.review}   duplicate: ${report.duplicate}   failed: ${report.failed}${report.pending_in_batches ? `   pending in batches: ${report.pending_in_batches}` : ""}`);
  console.log(`  ${report.part_rows_exported} part rows → ${xlsxPath}`);
  console.log(`  tokens — in: ${tokIn.toLocaleString()}  out: ${tokOut.toLocaleString()}${report.estimated_cost_usd != null ? `  ≈ $${report.estimated_cost_usd} at the rates supplied` : "  (pass --price-in/--price-out to estimate cost; see https://docs.claude.com/en/docs/about-claude/pricing)"}`);
  if (report.review) console.log(`  ⚠ ${report.review} invoice(s) failed totals reconciliation — their rows carry Review=yes and the app will hold them in the Ingest review queue.`);
  if (report.failed) console.log(`  ✗ ${report.failed} failure(s) — see Run Log sheet or manifest.json; re-run with --retry-failed after fixing.`);
  console.log("=============================================");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error("FATAL:", err.message || err); process.exit(1); });
}
