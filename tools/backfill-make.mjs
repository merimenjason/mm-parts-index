#!/usr/bin/env node
/* ============================================================================
   PartsIndex — backfill the vehicle make on part lines that were imported
   without one.

   WHY THIS EXISTS
   Supplier bills frequently do not print the vehicle make anywhere on the page:
   it belongs to the claim file, not to the invoice. The OCR therefore returned
   no make for a large minority of documents, and those lines landed in the
   shared reference as make "Unknown". Unknown makes are not just cosmetic —
   with cfg.sameMake on, a line whose make is unknown cannot be held to a
   make-specific benchmark, so the reference silently loses precision.

   The make IS recoverable: the scanned files are filed as
     <date>-<insurer>-<MAKE>-<n>.<ext>
   and every invoice JSON under ocr_out/json/ records the filename it was read
   from in _source_file. So this is a pure data-shuffle over files already on
   disk — no re-OCR, no API calls, no cost.

   PATCHING THE BATCH RUNNER IS NOT ENOUGH. tools/batch-ocr.mjs is an offline
   tool; changing it only affects documents OCR'd from that point on. Rows that
   are already in the database keep their Unknown make until something rewrites
   them. That is this script.

   THE JOIN
   Part rows do not store which file they came from (see PART_COLUMNS in
   api/_db.js), so we join on supplier + bill_no, which the parts table already
   indexes (idx_parts_bill). The join is unique in practice but not guaranteed:
   an invoice whose bill number failed to extract cannot be matched, and is
   reported as unmatched rather than guessed at.

   Usage:
     # dry run — prints exactly what WOULD change, writes nothing (the default)
     TURSO_DATABASE_URL=libsql://<db>.turso.io TURSO_AUTH_TOKEN=<token> \
       node tools/backfill-make.mjs --json-dir /home/jason/mm-parts-index/ocr_out/json

     # same, then actually write
     … node tools/backfill-make.mjs --json-dir <dir> --apply

   Flags:
     --json-dir <dir>   directory of invoice JSONs (default ./ocr_out/json)
     --apply            perform the UPDATEs (otherwise dry run)
     --canon            ALSO rewrite makes that are present but spelled
                        inconsistently ("Mercedes" / "MERCEDES BENZ" →
                        "Mercedes-Benz"), which otherwise split one marque
                        across several clusters
     --csv <path>       write the full proposed change list for review
   ============================================================================ */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { db, ensureSchema } from "../api/_db.js";
import { canonMake } from "../src/pipeline.js";
import { makeFromFilename } from "./batch-ocr.mjs";

const UNKNOWN = new Set(["", "unknown", "n/a", "na", "-", "—", "?"]);
const isBlankMake = (m) => UNKNOWN.has(String(m || "").trim().toLowerCase());
const joinKey = (supplier, billNo) =>
  `${String(supplier || "").trim().toLowerCase()}|${String(billNo || "").trim().toLowerCase()}`;

function parseArgs(argv) {
  const o = { jsonDir: "ocr_out/json", apply: false, canon: false, csv: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") o.apply = true;
    else if (a === "--canon") o.canon = true;
    else if (a === "--json-dir") o.jsonDir = argv[++i];
    else if (a === "--csv") o.csv = argv[++i];
  }
  return o;
}

/* Build supplier|bill_no → { make, source } from the invoice JSONs. An invoice
   with no bill number has no usable key and is counted, not silently dropped. */
export function buildMakeIndex(jsonDir) {
  const index = new Map();
  const stats = { files: 0, noKey: 0, noMake: 0, fromOcr: 0, fromFilename: 0, collisions: 0 };
  for (const f of fs.readdirSync(jsonDir)) {
    if (!f.endsWith(".json")) continue;
    let inv;
    try { inv = JSON.parse(fs.readFileSync(path.join(jsonDir, f), "utf8")); }
    catch { continue; }
    stats.files++;
    if (!inv.bill_no || !inv.supplier_name) { stats.noKey++; continue; }

    const ocrRaw = canonMake(inv.make);
    const ocr = ocrRaw === "Unknown" ? "" : ocrRaw;
    const make = ocr || makeFromFilename(inv._source_file || "");
    if (!make) { stats.noMake++; continue; }
    ocr ? stats.fromOcr++ : stats.fromFilename++;

    const k = joinKey(inv.supplier_name, inv.bill_no);
    const prior = index.get(k);
    if (prior && prior.make !== make) stats.collisions++;
    index.set(k, { make, source: ocr ? "ocr" : "filename", file: inv._source_file || f });
  }
  return { index, stats };
}

/* Decide the new make for one stored row, or null to leave it alone. */
export function planRow(row, index, { canon }) {
  const hit = index.get(joinKey(row.supplier, row.bill_no));
  const current = String(row.make || "").trim();
  if (isBlankMake(current)) {
    if (!hit) return null;
    return { id: row.id, from: current || "Unknown", to: hit.make, why: `backfill (${hit.source})`, file: hit.file };
  }
  if (!canon) return null;
  const c = canonMake(current);
  if (c && c !== "Unknown" && c !== current) return { id: row.id, from: current, to: c, why: "canonicalise", file: hit ? hit.file : "" };
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!process.env.TURSO_DATABASE_URL) {
    console.error("Set TURSO_DATABASE_URL (e.g. file:local.db, or libsql://<db>.turso.io with TURSO_AUTH_TOKEN).");
    process.exit(1);
  }
  if (!fs.existsSync(opts.jsonDir)) {
    console.error(`No such directory: ${opts.jsonDir} — pass --json-dir <dir>.`);
    process.exit(1);
  }

  const { index, stats } = buildMakeIndex(opts.jsonDir);
  console.log(`Invoice JSONs read : ${stats.files}`);
  console.log(`  usable join keys : ${index.size}  (${stats.fromOcr} make from OCR, ${stats.fromFilename} from filename)`);
  console.log(`  no supplier/bill : ${stats.noKey}`);
  console.log(`  no make at all   : ${stats.noMake}`);
  if (stats.collisions) console.log(`  ⚠ ${stats.collisions} key collision(s) with differing makes — last one wins`);

  await ensureSchema();
  const res = await db().execute("SELECT id, supplier, bill_no, make, part_name FROM parts");
  const rows = res.rows;
  const blank = rows.filter((r) => isBlankMake(r.make));
  console.log(`\nPart lines in database : ${rows.length}`);
  console.log(`  with no usable make  : ${blank.length}`);

  const plan = [];
  for (const r of rows) {
    const p = planRow(r, index, { canon: opts.canon });
    if (p) plan.push({ ...p, supplier: r.supplier, bill_no: r.bill_no, part_name: r.part_name });
  }
  const backfills = plan.filter((p) => p.why.startsWith("backfill"));
  const canons = plan.filter((p) => p.why === "canonicalise");
  const stillBlank = blank.length - backfills.length;

  const tally = {};
  backfills.forEach((p) => { tally[p.to] = (tally[p.to] || 0) + 1; });
  console.log(`\nProposed changes`);
  console.log(`  backfilled  : ${backfills.length} line(s)`);
  Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log(`      ${String(n).padStart(4)}  ${m}`));
  console.log(`  still blank : ${stillBlank} line(s) — no invoice JSON matched their supplier + bill no`);
  if (opts.canon) {
    const ct = {};
    canons.forEach((p) => { ct[`${p.from} → ${p.to}`] = (ct[`${p.from} → ${p.to}`] || 0) + 1; });
    console.log(`  canonicalised: ${canons.length} line(s)`);
    Object.entries(ct).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log(`      ${String(n).padStart(4)}  ${m}`));
  }

  if (opts.csv) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["id,supplier,bill_no,part_name,from,to,why,source_file"]
      .concat(plan.map((p) => [p.id, p.supplier, p.bill_no, p.part_name, p.from, p.to, p.why, p.file].map(esc).join(",")))
      .join("\n");
    fs.writeFileSync(opts.csv, csv);
    console.log(`\nChange list written to ${opts.csv}`);
  }

  if (!opts.apply) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to perform ${plan.length} update(s).`);
    return;
  }
  if (!plan.length) { console.log("\nNothing to do."); return; }

  // One batched transaction: either the whole backfill lands or none of it does,
  // so a mid-run failure can't leave the shared reference half-rewritten.
  await db().batch(plan.map((p) => ({ sql: "UPDATE parts SET make = ? WHERE id = ?", args: [p.to, p.id] })), "write");
  console.log(`\n✓ Updated ${plan.length} part line(s).`);
}

// Only run when invoked directly — the self-tests import buildMakeIndex/planRow.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error("FATAL:", err.message || err); process.exit(1); });
}
