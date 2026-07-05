/* Tiny mock of POST /v1/messages for integration-testing tools/batch-ocr.mjs.
   Behaviour keyed on the (fake) document content so each fixture exercises a path:
     GOOD      → valid invoice JSON
     GOOD2     → a second valid invoice (different bill)
     DUPL      → same supplier+bill as GOOD (dedup path)
     SHORT     → invoice missing a line (reconciliation → review)
     GARBAGE   → non-JSON rambling (failed path)
     FLAKY     → 529 on first hit, valid JSON on retry (retry path)
   Run: node tools/mock-server.mjs  (listens on 127.0.0.1:8787) */
import http from "node:http";

const inv = (bill, parts, subtotal) => JSON.stringify({
  supplier_name: "Mock Supplier Pte Ltd", supplier_id: "", bill_no: bill, bill_date: "01/06/2026",
  repairer: "", vehicle: "", chassis: "", make: "Toyota", model: "Corolla",
  doc_type: "Tax Invoice", gst_treatment: "excl", parts_subtotal: subtotal, gst_amount: 0, invoice_total: subtotal, parts,
});
const P1 = { part_name: "HEADLAMP RH (Original)", part_number: "T81110-02M40", qty: 1, unit_cost: 350, total_cost: 350, grade: "OEM Genuine", unit_basis: "each" };
const P2 = { part_name: "FR BUMPER COVER", part_number: "T52119-02M50", qty: 1, unit_cost: 200, total_cost: 200, grade: "Unknown", unit_basis: "each" };

let flakyHits = 0;
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const doc = Buffer.from(JSON.parse(body).messages[0].content[0].source.data, "base64").toString();
    let text, status = 200;
    if (doc.includes("FLAKY") && flakyHits++ === 0) { res.writeHead(529).end(JSON.stringify({ error: { type: "overloaded_error" } })); return; }
    if (doc.includes("GOOD2")) text = inv("MOCK-2002", [P2], 200);
    else if (doc.includes("DUPL")) text = inv("MOCK-2001", [P1, P2], 550);
    else if (doc.includes("SHORT")) text = inv("MOCK-2003", [P1], 550); // printed 550, extracted 350 → review
    else if (doc.includes("GARBAGE")) text = "I could not find any structured data, sorry!";
    else text = inv("MOCK-2001", [P1, P2], 550); // GOOD / FLAKY-retry
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 1234, output_tokens: 321 } }));
  });
}).listen(8787, "127.0.0.1", () => console.log("mock up on 8787"));
