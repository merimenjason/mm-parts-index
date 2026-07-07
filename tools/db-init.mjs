#!/usr/bin/env node
/* ============================================================================
   Initialise the PartsIndex libSQL/Turso database: create the schema, and
   optionally seed the 18-bill demo so a fresh deployment isn't empty.

   Usage:
     # local dev — creates ./local.db as a real SQLite file
     TURSO_DATABASE_URL=file:local.db node tools/db-init.mjs --seed

     # production — against a Turso database (token from the Turso CLI/dashboard)
     TURSO_DATABASE_URL=libsql://<db>.turso.io \
     TURSO_AUTH_TOKEN=<token> \
     node tools/db-init.mjs

   Flags:
     --seed   also insert the demo dataset (src/demoData.js → enrichPart)
     --force-seed  seed even if the parts table already has rows
   ============================================================================ */

import { ensureSchema, getDataset, replaceDataset, upsertParts } from "../api/_db.js";
import { enrichPart } from "../src/pipeline.js";
import { DEMO_18 } from "../src/demoData.js";

const args = process.argv.slice(2);
const seed = args.includes("--seed") || args.includes("--force-seed");
const force = args.includes("--force-seed");

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.error("Set TURSO_DATABASE_URL first (e.g. file:local.db, or libsql://<db>.turso.io with TURSO_AUTH_TOKEN).");
    process.exit(1);
  }
  console.log(`Initialising schema on ${process.env.TURSO_DATABASE_URL} …`);
  await ensureSchema();
  console.log("  ✓ schema ready");

  if (seed) {
    const existing = await getDataset();
    if (existing.parts.length && !force) {
      console.log(`  • parts table already has ${existing.parts.length} rows — skipping seed (use --force-seed to overwrite).`);
    } else {
      const parts = DEMO_18.map(enrichPart);
      if (force) await replaceDataset(parts);
      else await upsertParts(parts);
      console.log(`  ✓ seeded ${parts.length} demo part lines`);
    }
  }
  console.log("Done.");
}

main().catch((err) => { console.error("FATAL:", err.message || err); process.exit(1); });
