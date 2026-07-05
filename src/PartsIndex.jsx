import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

/* ============================================================
   PartsIndex — SG Motor TP Parts Pricing Reference
   Merimen / Fermion brand palette (petrol-teal + lime accent).
   Benchmark uses CONFIGURABLE FUZZY NAME MATCHING (not exact PN).
   All 8 analysis methods are computed and viewable under Analytics.
   Persists via window.storage. Demo = initial 18 supplier bills.
   ============================================================ */

/* ---------- Merimen "Fermion" brand palette ---------- */
const TEAL = "#006E96", TEAL_D = "#00567A", TEAL_L = "#00A0B9";
const LIME = "#C3D700", GREEN = "#2C7837", ICE = "#E1FAFF";
const INK = "#0A2733", PANEL = "#0F3543", LINE = "#1E4E60";
const TEXT = "#EAF6FA", MUTE = "#8FB6C4", RED = "#E8615A", AMBER = "#E8A33D";

const LOGO = "data:image/png;base64,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"; // Merimen "Fermion" mark (lime f)
const SG_MAKES = ["Toyota","Honda","Mazda","Nissan","Hyundai","Kia","Mercedes-Benz","BMW","Audi",
  "Volkswagen","Mitsubishi","Suzuki","Subaru","Lexus","Mitsubishi Fuso","Porsche","Chevrolet"];

import { DEMO_18 } from "./demoData.js";
import { enrichPart, buildClusters, median, mean, parseDate, GRADES, reconcileInvoice,
  normPN, similarity, snapshotId, buildDisputePack, upgradePart } from "./pipeline.js";
import { OCR_SYS, OCR_USER_TEXT } from "./ocrPrompt.js";

const APP_VERSION = "1.1.1";

/* Selectable Claude models for the live-OCR path (Ingest tab). The batch
   runner takes the same choice via --model. Sonnet is the tuned default;
   Haiku trades accuracy for cost on clean prints; Opus/Fable help on the
   worst faxes and handwriting at a higher price. */
const OCR_MODELS = [
  ["claude-sonnet-4-6", "Sonnet 4.6 — default: fast, accurate, economical"],
  ["claude-haiku-4-5-20251001", "Haiku 4.5 — fastest & cheapest, for clean prints"],
  ["claude-opus-4-8", "Opus 4.8 — stronger on faint fax / handwriting"],
  ["claude-fable-5", "Fable 5 — most capable, highest cost"],
];
const MODEL_KEY = "partsindex_ocr_model";

/* ================= persistence ================= */
const KEY = "partsindex_dataset_v3";
// Returns null when nothing has been stored yet (first run) so the app can seed the demo.
async function loadDS() {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function saveDS(ds) { try { localStorage.setItem(KEY, JSON.stringify(ds)); } catch (e) { console.error(e); } }

/* ================= Claude OCR =================
   The system prompt lives in src/ocrPrompt.js — the single source of truth
   shared with the bulk runner (tools/batch-ocr.mjs). Tune it there. */
async function ocrFile(base64, mediaType, isPdf, model) {
  const docBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  // Routed through the serverless proxy (api/ocr.js) so the API key stays server-side.
  const res = await fetch("/api/ocr", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || "claude-sonnet-4-6", max_tokens: 4000, system: OCR_SYS,
      messages: [{ role: "user", content: [docBlock, { type: "text", text: OCR_USER_TEXT }] }] }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
}
const fileToB64 = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file);
});

/* ================= flexible Excel mapping ================= */
function col(headers, ...needles) {
  const h = headers.map((x) => String(x).toLowerCase());
  for (const n of needles) { const i = h.findIndex((x) => n.every((w) => x.includes(w))); if (i >= 0) return i; }
  return -1;
}
function parseExcel(wb) {
  const out = [];
  wb.SheetNames.forEach((sn) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false });
    let hi = rows.findIndex((r) => r && r.some((c) => /part/i.test(String(c))) && r.some((c) => /(number|no\.?|part no)/i.test(String(c))));
    if (hi < 0) return;
    const H = rows[hi];
    const iName=col(H,["part","name"],["particular"],["descript"]), iNo=col(H,["part","number"],["part","no"],["stockid"],["part no"]);
    const iQty=col(H,["qty"],["quant"]), iUnit=col(H,["unit"],["u/price"],["u.price"]), iTot=col(H,["total"],["amount"],["line"]);
    const iSup=col(H,["supplier"]), iMake=col(H,["make"]), iModel=col(H,["model"]);
    const iBill=col(H,["bill","no"],["invoice","no"],["bill ref"]), iDate=col(H,["date"]), iDoc=col(H,["doc","type"],["line","type"]);
    // columns emitted by tools/batch-ocr.mjs — read them so OCR-extracted grade/GST/review survive the Excel round-trip
    const iGrade=col(H,["grade"]), iBasis=col(H,["unit","basis"]), iGst=col(H,["gst"]);
    const iRevReason=col(H,["review","reason"]);
    const iReview=H.findIndex((x,ix)=>/review/i.test(String(x)) && ix!==iRevReason);
    if (iName < 0 && iNo < 0) return;
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r]; if (!row) continue;
      const name = iName >= 0 ? row[iName] : "", no = iNo >= 0 ? row[iNo] : "";
      if (!name && !no) continue;
      const review = iReview >= 0 && /^(y|yes|true|1)$/i.test(String(row[iReview] || "").trim());
      out.push({ part_name: name, part_number: no, qty: iQty>=0?row[iQty]:1, unit_cost: iUnit>=0?row[iUnit]:0,
        total_cost: iTot>=0?row[iTot]:0, supplier: iSup>=0?row[iSup]:(sn||""), make: iMake>=0?row[iMake]:"",
        model: iModel>=0?row[iModel]:"", bill_no: iBill>=0?row[iBill]:"", bill_date: iDate>=0?row[iDate]:"",
        doc_type: iDoc>=0?row[iDoc]:"Tax Invoice", src: "excel",
        grade: iGrade>=0?row[iGrade]:"", unit_basis: iBasis>=0?row[iBasis]:"", gst: iGst>=0?row[iGst]:"",
        review, review_reason: review && iRevReason>=0 ? String(row[iRevReason]||"") : "" });
    }
  });
  return out;
}

/* ================= App ================= */
export default function App() {
  const [ds, setDs] = useState({ parts: [] });
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(null);
  const [log, setLog] = useState([]);
  const [q, setQ] = useState(""), [fMake, setFMake] = useState("All"), [fType, setFType] = useState("All");
  const [cfg, setCfg] = useState({ mode: "fuzzy-name", threshold: 0.65, sameMake: true, sameModel: false, tokenWeight: 0.6, bridge: false, sepGrade: true });
  const [method, setMethod] = useState("benchmark");
  const [inflPct, setInflPct] = useState(30);
  const [ocrModel, setOcrModelState] = useState(() => {
    try { const v = localStorage.getItem(MODEL_KEY); return OCR_MODELS.some(([m]) => m === v) ? v : OCR_MODELS[0][0]; }
    catch { return OCR_MODELS[0][0]; }
  });
  const setOcrModel = (m) => { setOcrModelState(m); try { localStorage.setItem(MODEL_KEY, m); } catch {} };
  const excelRef = useRef(), invRef = useRef();

  useEffect(() => {
    loadDS().then((stored) => {
      if (stored && Array.isArray(stored.parts)) {
        // Migrate datasets persisted by older app versions: back-fill fields added
        // since (grade, unit basis, GST, review) so stale lines don't render empty
        // badges or dodge the grade/basis merge guards. Existing values always win.
        const upgraded = { ...stored, parts: stored.parts.map(upgradePart) };
        setDs(upgraded); saveDS(upgraded);
      }
      else { const seeded = { parts: DEMO_18.map(enrichPart) }; setDs(seeded); saveDS(seeded); } // first run -> demo
    });
  }, []);
  const commit = useCallback((next) => { setDs(next); saveDS(next); }, []);
  const addLog = (m) => setLog((L) => [`${new Date().toLocaleTimeString()}  ${m}`, ...L].slice(0, 40));
  const addRaw = (raws, label) => { const enr = raws.map(enrichPart); commit({ parts: [...ds.parts, ...enr] }); addLog(`+${enr.length} parts from ${label}`); };

  const onExcel = async (e) => {
    const files = [...e.target.files]; if (!files.length) return; setLoading("Reading spreadsheets…");
    try { for (const f of files) { const wb = XLSX.read(await f.arrayBuffer(), { type: "array" }); addRaw(parseExcel(wb), f.name); } }
    catch (err) { addLog(`Excel error: ${err.message}`); } setLoading(null); e.target.value = "";
  };
  const onInvoice = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    for (const f of files) { setLoading(`OCR: ${f.name} · ${ocrModel}…`);
      try { const b64 = await fileToB64(f); const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        const j = await ocrFile(b64, f.type || "image/png", isPdf, ocrModel);
        // Dedup gate: the same supplier+bill_no must never be ingested twice, or its quotes double-count and skew medians.
        const dupKey = `${(j.supplier_name || "").trim().toLowerCase()}|${(j.bill_no || "").trim().toLowerCase()}`;
        if (j.bill_no && ds.parts.some((p) => `${p.supplier.trim().toLowerCase()}|${p.bill_no.trim().toLowerCase()}` === dupKey)) {
          addLog(`Skipped ${f.name}: bill ${j.bill_no} from ${j.supplier_name} is already in the dataset (duplicate)`); continue;
        }
        // Reconciliation gate: extracted line sum vs the invoice's own printed subtotal/total.
        const rec = reconcileInvoice(j.parts || [], j);
        const flagged = rec.ok === false;
        const meta = { supplier: j.supplier_name, bill_no: j.bill_no, bill_date: j.bill_date, make: j.make, model: j.model,
          doc_type: j.doc_type, gst: j.gst_treatment,
          review: flagged, review_reason: flagged ? `Extracted lines sum S$${rec.sum} but printed ${rec.basis} is S$${rec.stated} (diff S$${rec.diff}) — lines may be missing or misread` : "" };
        addRaw((j.parts || []).map((p) => ({ ...p, ...meta, src: "ocr" })), f.name);
        if (flagged) addLog(`⚠ ${f.name}: totals do not reconcile (extracted S$${rec.sum} vs printed S$${rec.stated}) — held for review, excluded from benchmarks`);
        else if (rec.ok === null) addLog(`${f.name}: no printed subtotal/total to reconcile against — spot-check advised`);
        else addLog(`${f.name}: totals reconcile ✓ (S$${rec.sum} vs printed ${rec.basis})`);
      } catch (err) { addLog(`OCR failed for ${f.name}: ${err.message}`); } }
    setLoading(null); e.target.value = "";
  };
  // Review workflow: accept clears the flag (lines join the benchmark); discard removes the bill's lines.
  const acceptBill = (billNo) => { commit({ parts: ds.parts.map((p) => p.bill_no === billNo ? { ...p, review: false, review_reason: "" } : p) }); addLog(`Accepted bill ${billNo} after review`); };
  const discardBill = (billNo) => { commit({ parts: ds.parts.filter((p) => p.bill_no !== billNo) }); addLog(`Discarded bill ${billNo}`); };
  const loadDemo = () => { commit({ parts: DEMO_18.map(enrichPart) }); addLog("Loaded demo: 18 sample bills (174 lines)"); };
  const clearAll = () => { if (window.confirm("Remove all stored parts?")) { commit({ parts: [] }); addLog("Dataset cleared"); } };

  const parts = ds.parts;
  const clusters = useMemo(() => buildClusters(parts, cfg), [parts, cfg]);
  const makes = useMemo(() => ["All", ...[...new Set(parts.map((p) => p.make))].sort()], [parts]);
  const filtered = useMemo(() => parts.filter((p) =>
    (fMake === "All" || p.make === fMake) && (fType === "All" || p.ltype === fType) &&
    (!q || (p.part_name + p.part_number + p.supplier).toLowerCase().includes(q.toLowerCase()))
  ), [parts, q, fMake, fType]);
  const kpis = useMemo(() => {
    const usable = parts.filter((p) => p.ltype === "Supplier Part");
    return { invoices: new Set(parts.map((p) => p.bill_no).filter(Boolean)).size, lines: parts.length,
      usable: usable.length, makes: new Set(usable.map((p) => p.make)).size,
      clusters: clusters.length, ready: clusters.filter((c) => c.n > 1).length,
      review: parts.filter((p) => p.review).length };
  }, [parts, clusters]);

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parts.map(({ id, src, ...r }) => r)), "Parts DB");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clusters.map((c) => ({
      Cluster: c.label, Make: c.make, Category: c.cat, Grade: c.grade, UnitBasis: c.unit_basis, Quotes: c.n, Variants: c.names.join(" | "),
      Suppliers: c.suppliers.join(", "), Min: c.min, Median: c.med, Average: c.avg, Max: c.max })) ), "Benchmark");
    XLSX.writeFile(wb, "PartsIndex_export.xlsx");
  };

  const Tab = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ padding: "12px 18px", background: "none", border: "none", cursor: "pointer",
      color: tab === id ? "#fff" : MUTE, fontWeight: tab === id ? 700 : 500, fontSize: 13,
      borderBottom: tab === id ? `3px solid ${LIME}` : "3px solid transparent", letterSpacing: ".02em" }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: INK, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ background: TEAL_D, padding: "16px 26px", display: "flex", alignItems: "center", gap: 15 }}>
        <img src={LOGO} alt="Merimen" width={34} height={34} style={{ borderRadius: 9, display: "block" }} />
        <div><div style={{ fontSize: 18, fontWeight: 800 }}>PartsIndex</div>
          <div style={{ fontSize: 11, color: "#BFE6EF" }}>Parts Pricing Reference for SG Motor Third-Party Claims</div></div>
        <div style={{ flex: 1 }} />
        {loading
          ? <div style={{ fontSize: 12, color: LIME, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 8, background: LIME, animation: "pulse 1s infinite" }} />{loading}</div>
          : <div style={{ fontSize: 11, color: "#BFE6EF", textAlign: "right" }}>Powered by Merimen Claims Data<br /><span style={{ opacity: .7 }}>fuzzy-matched median benchmark</span></div>}
      </div>
      <div style={{ background: TEAL, padding: "0 18px", display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Tab id="dashboard" label="Dashboard" /><Tab id="upload" label="Ingest" />
        <Tab id="parts" label="Parts Ledger" /><Tab id="bench" label="Benchmark" />
        <Tab id="assess" label="Assess a Claim" /><Tab id="analytics" label="Analytics" />
        <Tab id="coverage" label="Coverage" /><Tab id="methods" label="Method Notes" />
      </div>

      <div style={{ padding: 26, maxWidth: 1240, margin: "0 auto" }}>
        {tab === "dashboard" && <Dashboard parts={parts} clusters={clusters} kpis={kpis} onDemo={loadDemo} onGo={() => setTab("upload")} />}
        {tab === "upload" && <Ingest {...{ excelRef, invRef, onExcel, onInvoice, loadDemo, exportXlsx, clearAll, parts, log, acceptBill, discardBill, ocrModel, setOcrModel }} />}
        {tab === "parts" && <Ledger {...{ q, setQ, fMake, setFMake, fType, setFType, makes, filtered }} />}
        {tab === "bench" && <Benchmark {...{ cfg, setCfg, clusters }} />}
        {tab === "assess" && <Assess {...{ parts, clusters, cfg, inflPct, setInflPct }} />}
        {tab === "analytics" && <Analytics {...{ parts, clusters, cfg, method, setMethod, inflPct, setInflPct }} />}
        {tab === "coverage" && <Coverage {...{ parts, clusters }} />}
        {tab === "methods" && <MethodNotes />}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} *{box-sizing:border-box} ::selection{background:${LIME};color:${TEAL_D}}
        input[type=range]{accent-color:${LIME}}`}</style>
    </div>
  );
}

/* ---------- shared bits ---------- */
const btn = (bg, fg) => ({ marginTop: 14, padding: "10px 16px", background: bg, color: fg, border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" });
const inp = (w) => ({ width: w, padding: "9px 11px", background: "#082430", color: TEXT, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, outline: "none" });
const th = { textAlign: "left", padding: "10px 12px", fontSize: 11, color: MUTE, fontWeight: 700, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".04em" };
const td = { padding: "8px 12px", whiteSpace: "nowrap" };
function Card({ title, children, span }) {
  return <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, gridColumn: span }}>
    {title && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#fff" }}>{title}</div>}{children}</div>;
}
// Shared drill-down: lists the individual quotes behind a benchmark cluster.
// Format: part name · part number · supplier · unit price · bill date, plus two
// optional tags — GRADE (only when known) and PER PAIR / PER SET (only when the
// line doesn't price a single unit). Hover a tag for what it means.
function QuoteLines({ c }) {
  return (<>{c.members.map((m, k) => (
    <div key={k} style={{ padding: "2px 0" }}>
      <span style={{ color: TEXT }}>{m.part_name}</span> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{m.part_number || "—"}</span> · {m.supplier} · <b style={{ color: LIME }}>S${m.unit}</b>{m.bill_date ? " · " + m.bill_date : ""}
      {m.grade && m.grade !== "Unknown" && <span title={`Parts grade: ${m.grade} — printed on the bill or inferred from name tags like (ORIGINAL) or (TW). Grade is the biggest legitimate price driver, so quotes of different known grades are never merged into one benchmark.`} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", cursor: "help", color: m.grade === "OEM Genuine" ? LIME : AMBER, border: `1px solid ${m.grade === "OEM Genuine" ? LIME : AMBER}`, borderRadius: 4, padding: "0 4px" }}>{m.grade}</span>}
      {m.unit_basis && m.unit_basis !== "each" && <span title={`This line prices a ${m.unit_basis} (e.g. LH+RH together), not a single unit — per-${m.unit_basis} prices are kept out of per-each medians so they can't skew the benchmark.`} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", cursor: "help", color: TEAL_L, border: `1px solid ${TEAL_L}`, borderRadius: 4, padding: "0 4px" }}>per {m.unit_basis}</span>}
    </div>))}</>);
}

function Dashboard({ parts, clusters, kpis, onDemo, onGo }) {
  const [openTop, setOpenTop] = useState(null);
  const [kpi, setKpi] = useState(null);
  const clickable = parts.length > 0;
  return (<>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
      {[["invoices","Invoices", kpis.invoices, TEAL_L], ["lines","Part lines", kpis.lines, "#fff"], ["usable","Usable supplier parts", kpis.usable, "#fff"],
        ["clusters","Fuzzy clusters", kpis.clusters, "#fff"], ["makes","Makes covered", kpis.makes, "#fff"], ["ready","Benchmark-ready", kpis.ready, LIME],
        ...(kpis.review ? [["review","Needs review", kpis.review, AMBER]] : [])]
        .map(([id, l, v, c]) => { const active = kpi === id;
        return (
        <div key={id} onClick={() => clickable && setKpi(active ? null : id)}
          style={{ background: active ? "#123E4D" : PANEL, border: `1px solid ${active ? LIME : LINE}`, borderRadius: 10, padding: "16px 18px", cursor: clickable ? "pointer" : "default", transition: "background .12s, border-color .12s" }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
          <div style={{ fontSize: 11.5, color: active ? TEXT : MUTE, marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {l}{clickable && <span style={{ color: active ? LIME : "#4B6F80", fontSize: 10 }}>{active ? "▾" : "▸"}</span>}</div></div>); })}
    </div>
    {kpi && clickable && <KpiDetail kpi={kpi} parts={parts} clusters={clusters} onClose={() => setKpi(null)} />}
    {parts.length === 0 ? (
      <div style={{ border: `1px dashed ${LINE}`, borderRadius: 12, padding: 44, textAlign: "center", background: PANEL }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff" }}>No parts stored yet</div>
        <div style={{ color: MUTE, fontSize: 13, maxWidth: 470, margin: "0 auto 20px", lineHeight: 1.6 }}>
          Bring in the supplier bills, or load the 18-bill demo set to explore the analytics right away.</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onGo} style={btn(LIME, TEAL_D)}>Go to Ingest</button>
          <button onClick={onDemo} style={btn(ICE, TEAL_D)}>Load demo (18 bills)</button></div>
      </div>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Coverage vs common SG makes">
          {SG_MAKES.map((m) => { const n = parts.filter((p) => p.make === m && p.ltype === "Supplier Part").length;
            return (<div key={m} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12.5 }}>
              <span style={{ width: 120, color: n ? TEXT : MUTE }}>{m}</span>
              <div style={{ flex: 1, height: 7, background: "#0A2C38", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, n * 6)}%`, height: "100%", background: n ? LIME : "transparent" }} /></div>
              <span style={{ width: 28, textAlign: "right", color: MUTE }}>{n || "—"}</span></div>); })}
        </Card>
        <Card title="Top fuzzy-matched benchmarks (≥2 quotes)">
          {clusters.filter((c) => c.n > 1).slice(0, 10).map((c, i) => {
            const id = c.key + i, isOpen = openTop === id;
            return (
              <div key={id} style={{ borderBottom: `1px solid ${LINE}` }}>
                <div onClick={() => setOpenTop(isOpen ? null : id)} style={{ padding: "7px 0", fontSize: 12.5, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{c.label}</span>
                    <span style={{ color: LIME, fontWeight: 700 }}>S${c.med}</span></div>
                  <div style={{ color: MUTE, fontSize: 11, paddingLeft: 16 }}>{c.make} · {c.n} quotes · {c.suppliers.length} suppliers · range S${c.min}–{c.max}</div></div>
                {isOpen && <div style={{ padding: "2px 0 8px 16px", fontSize: 11, color: MUTE }}><QuoteLines c={c} /></div>}
              </div>); })}
          {clusters.filter((c) => c.n > 1).length === 0 &&
            <div style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.6 }}>No clusters with 2+ quotes at the current matching setting. Loosen the threshold on the Benchmark tab.</div>}
        </Card>
      </div>
    )}
  </>);
}

// Lists raw part lines behind a grouped KPI row.
function PartLines({ items }) {
  return (<>{items.map((m, k) => (
    <div key={k} style={{ padding: "2px 0" }}>
      <span style={{ color: TEXT }}>{m.part_name}</span> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{m.part_number || "—"}</span> · {m.make}{m.cat ? " · " + m.cat : ""} · {m.supplier} · <b style={{ color: LIME }}>S${(m.unit || 0).toFixed(2)}</b>{m.bill_no ? " · bill " + m.bill_no : ""}
    </div>))}</>);
}
// Table whose rows expand to reveal their member part lines (or custom detail).
function ExpandTable({ cols, rows, colSpan }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: INK }}>{cols.map((c) => <th key={c.k} style={{ ...th, textAlign: c.a || "left" }}>{c.h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => { const isOpen = open === i; return (
          <React.Fragment key={i}>
            <tr onClick={() => setOpen(isOpen ? null : i)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: r._bg || "transparent" }}>
              {cols.map((c, ci) => <td key={c.k} style={{ ...td, textAlign: c.a || "left", color: r["_c" + c.k] || (c.mut ? MUTE : TEXT), fontFamily: c.mono ? "ui-monospace,monospace" : "inherit", fontWeight: c.b ? 700 : 400 }}>
                {ci === 0 && <span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>}{r[c.k]}</td>)}
            </tr>
            {isOpen && <tr style={{ background: INK }}><td colSpan={colSpan || cols.length} style={{ padding: "8px 14px 10px 26px", fontSize: 11.5, color: MUTE }}>{r._detail}</td></tr>}
          </React.Fragment>); })}</tbody></table></div>
  );
}

function KpiDetail({ kpi, parts, clusters, onClose }) {
  const [open, setOpen] = useState(null);
  const usable = parts.filter((p) => p.ltype === "Supplier Part");
  const TITLES = { invoices: "Invoices / bills in the dataset", lines: "Part lines by type",
    usable: "Usable supplier parts by category", clusters: "Fuzzy cluster sizes",
    makes: "Coverage by make", ready: "Benchmark-ready parts (≥2 quotes)" };
  let body = null, note = null;

  if (kpi === "review") {
    const flagged = parts.filter((p) => p.review);
    note = "These lines failed the totals-reconciliation check at OCR time. Resolve them on the Ingest tab (Accept / Discard).";
    body = <div style={{ fontSize: 11.5, color: MUTE }}><PartLines items={flagged} /></div>;
  }
  if (kpi === "invoices") {
    const g = {};
    parts.forEach((p) => { const k = p.bill_no || "(no number)";
      (g[k] ||= { bill: k, supplier: p.supplier, date: p.bill_date || "—", make: p.make, doc: p.doc_type, items: [], total: 0 });
      g[k].items.push(p); g[k].total += p.total || 0; });
    const rows = Object.values(g).sort((a, b) => b.items.length - a.items.length).map((r) => ({
      bill: r.bill, supplier: r.supplier, date: r.date, make: r.make, doc: r.doc, n: r.items.length, total: r.total.toFixed(2),
      _detail: <PartLines items={r.items} /> }));
    body = <ExpandTable cols={[{k:"bill",h:"Bill no"},{k:"supplier",h:"Supplier"},{k:"date",h:"Date"},{k:"make",h:"Make"},{k:"doc",h:"Type",mut:1},{k:"n",h:"Lines",a:"center"},{k:"total",h:"Total S$",a:"right",b:1}]} rows={rows} />;
    note = `${rows.length} distinct bills. Click a bill to see its part lines.`;
  } else if (kpi === "lines") {
    const order = ["Supplier Part","Consumable / Fastener","Repair Estimate","Labour"];
    const rows = order.map((t) => { const items = parts.filter((p) => p.ltype === t);
      return items.length ? { type: t, n: items.length, pct: parts.length ? ((items.length / parts.length) * 100).toFixed(0) + "%" : "0%",
        _ctype: t === "Supplier Part" ? LIME : TEXT, _detail: <PartLines items={items.slice(0, 200)} /> } : null; }).filter(Boolean);
    body = <ExpandTable cols={[{k:"type",h:"Line type"},{k:"n",h:"Count",a:"center",b:1},{k:"pct",h:"Share",a:"right",mut:1}]} rows={rows} />;
    note = "Only Supplier Part lines feed the cost benchmark. Click a type to see its lines.";
  } else if (kpi === "usable") {
    const g = {}; usable.forEach((p) => { (g[p.cat] ||= { cat: p.cat, items: [], pn: new Set() }); g[p.cat].items.push(p); g[p.cat].pn.add(p.npn); });
    const rows = Object.values(g).sort((a, b) => b.items.length - a.items.length).map((r) => ({
      cat: r.cat, n: r.items.length, pn: r.pn.size, _detail: <PartLines items={r.items} /> }));
    body = <ExpandTable cols={[{k:"cat",h:"Category"},{k:"n",h:"Parts",a:"center",b:1},{k:"pn",h:"Distinct part nos",a:"center",mut:1}]} rows={rows} />;
    note = `${usable.length} usable supplier parts across ${rows.length} categories. Click a category to see its parts.`;
  } else if (kpi === "clusters") {
    const bands = [["1 quote", (c) => c.n === 1], ["2 quotes", (c) => c.n === 2], ["3 quotes", (c) => c.n === 3], ["4+ quotes", (c) => c.n >= 4]];
    const rows = bands.map(([size, f]) => { const cs = clusters.filter(f); return cs.length ? {
      size, n: cs.length, _csize: size === "1 quote" ? MUTE : LIME,
      _detail: cs.slice(0, 60).map((c, k) => <div key={k} style={{ padding: "2px 0" }}>
        <span style={{ color: TEXT }}>{c.label}</span> · {c.make} · {c.cat} · <b style={{ color: LIME }}>median S${c.med}</b>{c.n > 1 ? ` · ${c.suppliers.length} suppliers · range S$${c.min}–${c.max}` : ""}</div>) } : null; }).filter(Boolean);
    body = <ExpandTable cols={[{k:"size",h:"Cluster size"},{k:"n",h:"# clusters",a:"center",b:1}]} rows={rows} />;
    note = `${clusters.length} clusters from ${usable.length} usable parts. ${clusters.filter((c) => c.n > 1).length} have ≥2 quotes. Click a band to list its clusters.`;
  } else if (kpi === "makes") {
    const mk = [...new Set(usable.map((p) => p.make))];
    const rows = mk.map((m) => { const cs = clusters.filter((c) => c.make === m); const items = usable.filter((p) => p.make === m);
      return { make: m, parts: items.length, clusters: cs.length, ready: cs.filter((c) => c.n > 1).length, _cready: LIME, _detail: <PartLines items={items} /> }; })
      .sort((a, b) => b.parts - a.parts);
    body = <ExpandTable cols={[{k:"make",h:"Make"},{k:"parts",h:"Usable parts",a:"center"},{k:"clusters",h:"Clusters",a:"center"},{k:"ready",h:"Benchmark-ready",a:"center",b:1}]} rows={rows} />;
    note = `${mk.length} makes represented. Click a make to see its parts.`;
  } else if (kpi === "ready") {
    const ready = clusters.filter((c) => c.n > 1);
    body = (
      <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: INK }}>{[["Benchmark part","left"],["Make","left"],["Quotes","center"],["Suppliers","center"],["Median S$","right"],["Range S$","right"]].map(([h,a]) => <th key={h} style={{ ...th, textAlign: a }}>{h}</th>)}</tr></thead>
          <tbody>{ready.map((c, i) => { const id = c.key + i, isOpen = open === id; return (
            <React.Fragment key={id}>
              <tr onClick={() => setOpen(isOpen ? null : id)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: "rgba(195,215,0,.10)" }}>
                <td style={{ ...td, fontWeight: 600 }}><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{c.label}{c.names.length > 1 && <span style={{ color: MUTE, fontWeight: 400 }}> +{c.names.length - 1}</span>}</td>
                <td style={td}>{c.make}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 800, color: LIME }}>{c.n}</td>
                <td style={{ ...td, textAlign: "center", color: MUTE }}>{c.suppliers.length}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 800, color: LIME }}>{c.med}</td>
                <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.min}–{c.max}</td></tr>
              {isOpen && <tr style={{ background: INK }}><td colSpan={6} style={{ padding: "8px 14px", fontSize: 11.5, color: MUTE }}><QuoteLines c={c} /></td></tr>}
            </React.Fragment>); })}</tbody></table></div>);
    note = "Click a part to see the individual quotes behind its benchmark.";
  }

  return (
    <div style={{ background: "#0C2E3A", border: `1px solid ${LIME}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{TITLES[kpi]}</div>
        <button onClick={onClose} style={{ background: "none", border: `1px solid ${LINE}`, color: MUTE, borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>Close ✕</button>
      </div>
      {body}
      {note && <p style={{ color: MUTE, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>{note}</p>}
    </div>
  );
}
function Ingest({ excelRef, invRef, onExcel, onInvoice, loadDemo, exportXlsx, clearAll, parts, log, acceptBill, discardBill, ocrModel, setOcrModel }) {
  // Group flagged lines by bill for the review queue.
  const flaggedBills = useMemo(() => {
    const g = {};
    parts.filter((p) => p.review).forEach((p) => { (g[p.bill_no] ||= { bill_no: p.bill_no, supplier: p.supplier, reason: p.review_reason, lines: [] }).lines.push(p); });
    return Object.values(g);
  }, [parts]);
  return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
    {flaggedBills.length > 0 && (
      <Card title={`Needs review — ${flaggedBills.length} bill${flaggedBills.length > 1 ? "s" : ""} held back`} span="1 / -1">
        <p style={{ color: MUTE, fontSize: 12, lineHeight: 1.6 }}>These OCR'd bills failed the totals-reconciliation check: the sum of extracted lines does not match the invoice's own printed subtotal. They are <b style={{ color: AMBER }}>excluded from all benchmarks</b> until you accept or discard them. Check the lines against the original PDF, then decide.</p>
        {flaggedBills.map((b) => (
          <div key={b.bill_no} style={{ border: `1px solid ${AMBER}`, borderRadius: 10, padding: 12, marginTop: 10, background: "rgba(232,163,61,.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 13 }}>{b.supplier} · bill {b.bill_no}</b>
              <span style={{ color: MUTE, fontSize: 11.5 }}>{b.lines.length} lines</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => acceptBill(b.bill_no)} style={{ ...btn(LIME, TEAL_D), marginTop: 0, padding: "6px 12px" }}>Accept — lines are correct</button>
              <button onClick={() => discardBill(b.bill_no)} style={{ ...btn("#3A2226", "#F3B4B0"), marginTop: 0, padding: "6px 12px" }}>Discard bill</button>
            </div>
            <div style={{ color: AMBER, fontSize: 11.5, margin: "6px 0" }}>{b.reason}</div>
            <div style={{ fontSize: 11, color: MUTE, maxHeight: 120, overflow: "auto" }}><PartLines items={b.lines} /></div>
          </div>))}
      </Card>)}
    <Card title="Bulk upload · Claude-OCR'd Excel">
      <p style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.6 }}>Drop one or many .xlsx / .csv exports. Columns are matched flexibly (Part Name, Part No, Qty, Unit, Total, Supplier, Make, Model, Bill No, Date).</p>
      <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" multiple onChange={onExcel} style={{ display: "none" }} />
      <button onClick={() => excelRef.current.click()} style={btn(LIME, TEAL_D)}>Choose spreadsheets</button></Card>
    <Card title="OCR invoices · live via Claude">
      <p style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.6 }}>Upload raw invoice PDFs or images. Each is read by Claude, extracted to structured parts, enriched and stored.</p>
      <label style={{ display: "block", fontSize: 11, color: MUTE, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, margin: "10px 0 5px" }}>Claude model</label>
      <select value={ocrModel} onChange={(e) => setOcrModel(e.target.value)} style={inp(320)}>
        {OCR_MODELS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <input ref={invRef} type="file" accept=".pdf,image/*" multiple onChange={onInvoice} style={{ display: "none" }} />
      <div><button onClick={() => invRef.current.click()} style={btn(TEAL_L, "#fff")}>Choose invoices to OCR</button></div>
      <p style={{ color: MUTE, fontSize: 11, marginTop: 10 }}>The choice persists in this browser and applies to this button; the batch runner takes the same choice via <span style={{ fontFamily: "ui-monospace,monospace", color: TEAL_L }}>--model {ocrModel}</span>. In a deployed static site, route this through a serverless proxy so the API key stays server-side.</p></Card>
    <Card title="Dataset actions">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={loadDemo} style={btn(ICE, TEAL_D)}>Load demo (18 bills)</button>
        <button onClick={exportXlsx} style={btn("#123E4D", TEXT)} disabled={!parts.length}>Export .xlsx</button>
        <button onClick={clearAll} style={btn("#3A2226", "#F3B4B0")} disabled={!parts.length}>Clear dataset</button></div>
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 12 }}>Saved to persistent storage; reloads automatically next session.</p></Card>
    <Card title="Activity">
      <div style={{ maxHeight: 180, overflow: "auto", fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: MUTE }}>
        {log.length ? log.map((l, i) => <div key={i} style={{ padding: "2px 0" }}>{l}</div>) : <span>No activity yet.</span>}</div></Card>
  </div>);
}

function Ledger({ q, setQ, fMake, setFMake, fType, setFType, makes, filtered }) {
  return (<>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
      <input placeholder="Search part / number / supplier" value={q} onChange={(e) => setQ(e.target.value)} style={inp(240)} />
      <select value={fMake} onChange={(e) => setFMake(e.target.value)} style={inp(160)}>{makes.map((m) => <option key={m}>{m}</option>)}</select>
      <select value={fType} onChange={(e) => setFType(e.target.value)} style={inp(200)}>
        {["All", "Supplier Part", "Consumable / Fastener", "Repair Estimate", "Labour"].map((t) => <option key={t}>{t}</option>)}</select>
      <span style={{ color: MUTE, fontSize: 12.5, alignSelf: "center" }}>{filtered.length} rows</span></div>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: PANEL }}>{["Make","Category","Part name","Part no","Grade","Qty","Unit S$","Total S$","Line type","Supplier"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{filtered.slice(0, 400).map((p) => (
          <tr key={p.id} style={{ borderTop: `1px solid ${LINE}`, background: p.review ? "rgba(232,163,61,.12)" : p.ltype === "Repair Estimate" ? "#3A2226" : p.ltype.startsWith("Consumable") ? "#0C2E3A" : "transparent" }} title={p.review ? p.review_reason : undefined}>
            <td style={td}>{p.make}</td><td style={td}>{p.cat}</td><td style={{ ...td, fontWeight: 600 }}>{p.review && <span style={{ color: AMBER, marginRight: 5 }} title={p.review_reason}>⚠</span>}{p.part_name}</td>
            <td style={{ ...td, fontFamily: "ui-monospace,monospace", color: MUTE }}>{p.part_number}</td>
            <td style={{ ...td, fontSize: 11, color: !p.grade || p.grade === "Unknown" ? MUTE : p.grade === "OEM Genuine" ? LIME : AMBER }}>{!p.grade || p.grade === "Unknown" ? "—" : p.grade}{p.unit_basis && p.unit_basis !== "each" ? " · /" + p.unit_basis : ""}</td>
            <td style={{ ...td, textAlign: "center" }}>{p.qty}</td><td style={{ ...td, textAlign: "right" }}>{p.unit?.toFixed(2)}</td>
            <td style={{ ...td, textAlign: "right" }}>{p.total?.toFixed(2)}</td><td style={{ ...td, color: MUTE }}>{p.ltype}</td><td style={{ ...td, color: MUTE }}>{p.supplier}</td></tr>))}</tbody></table>
      {filtered.length > 400 && <div style={{ padding: 10, color: MUTE, fontSize: 12 }}>Showing first 400 of {filtered.length}.</div>}</div>
  </>);
}

/* ---------- Benchmark with configurable fuzzy matcher ---------- */
function Benchmark({ cfg, setCfg, clusters }) {
  const [open, setOpen] = useState(null);
  const set = (k, v) => setCfg({ ...cfg, [k]: v });
  return (<>
    <Card title="Matching configuration">
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12.5 }}>Mode&nbsp;
          <select value={cfg.mode} onChange={(e) => set("mode", e.target.value)} style={inp(210)}>
            <option value="fuzzy-name">Fuzzy part name only</option>
            <option value="hybrid">Hybrid (part no → name bridge)</option>
            <option value="exact-pn">Exact part no only</option>
            <option value="category">Category + make</option>
          </select></label>
        {(cfg.mode === "hybrid" || cfg.mode === "fuzzy-name") && <>
          <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={cfg.mode === "fuzzy-name" ? true : cfg.bridge} disabled={cfg.mode === "fuzzy-name"} onChange={(e) => set("bridge", e.target.checked)} /> Bridge by name across part numbers</label>
          <label style={{ fontSize: 12.5 }}>Similarity: <b style={{ color: LIME }}>{cfg.threshold.toFixed(2)}</b><br />
            <input type="range" min="0.4" max="0.95" step="0.05" value={cfg.threshold} onChange={(e) => set("threshold", +e.target.value)} style={{ width: 150 }} /></label>
          <label style={{ fontSize: 12.5 }}>Token/spelling: <b style={{ color: LIME }}>{cfg.tokenWeight.toFixed(1)}</b><br />
            <input type="range" min="0" max="1" step="0.1" value={cfg.tokenWeight} onChange={(e) => set("tokenWeight", +e.target.value)} style={{ width: 130 }} /></label>
        </>}
        <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={cfg.sameMake} onChange={(e) => set("sameMake", e.target.checked)} /> Same make</label>
        <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={cfg.sameModel} onChange={(e) => set("sameModel", e.target.checked)} /> Same model</label>
        <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }} title="Never merge an OEM-genuine quote with an aftermarket one — the single largest source of legitimate price variance. Unknown grades are never blocked.">
          <input type="checkbox" checked={cfg.sepGrade !== false} onChange={(e) => set("sepGrade", e.target.checked)} /> Separate grades (OEM vs aftermarket)</label>
      </div>
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}><b style={{ color: LIME }}>Fuzzy part name</b> (the default) clusters parts whose names are similar — good for forming multi-quote medians on a small dataset. <b>Hybrid</b> is the more conservative option: it groups by exact part number first — the identifier supplier bills carry that PeerIndex/eSource lack — and only bridges different part numbers by name when you turn bridging on (bridged rows are marked <b style={{ color: AMBER }}>≈</b> in the <b>Basis</b> column). Use <b>Same make</b>/<b>Same model</b> to stop, say, a Camry headlamp merging with a Hilux one, and the similarity/token sliders to tune name matching. As real volume builds and identical part numbers recur, prefer Hybrid for the most defensible number.</p>
    </Card>
    <p style={{ color: MUTE, fontSize: 12.5, margin: "14px 0", lineHeight: 1.6 }}><b style={{ color: LIME }}>Median</b> is the reference. Lime rows have ≥2 quotes. Click a row to see the grouped quotes.</p>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: PANEL }}>{["Benchmark part","Make","Category","Basis","Quotes","Suppliers","Min","Median","Avg","Max","Spread"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{clusters.slice(0, 400).map((c, i) => (
          <React.Fragment key={c.key + i}>
            <tr onClick={() => setOpen(open === c.key + i ? null : c.key + i)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: c.n > 1 ? "rgba(195,215,0,.12)" : "transparent" }}>
              <td style={{ ...td, fontWeight: 600 }}>{c.label}{c.names.length > 1 && <span style={{ color: MUTE, fontWeight: 400 }}> +{c.names.length - 1}</span>}
                {c.grade !== "Unknown" && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: c.gradeMixed ? RED : c.grade === "OEM Genuine" ? LIME : AMBER, border: `1px solid ${c.gradeMixed ? RED : c.grade === "OEM Genuine" ? LIME : AMBER}`, borderRadius: 4, padding: "0 4px", verticalAlign: "middle" }} title={c.gradeMixed ? "Cluster mixes grades: " + c.grades.join(", ") + " — median may blend genuine and aftermarket prices" : "All known-grade quotes are " + c.grade}>{c.gradeMixed ? "MIXED GRADE" : c.grade}</span>}</td>
              <td style={td}>{c.make}</td><td style={{ ...td, color: MUTE }}>{c.cat}</td>
              <td style={{ ...td, textAlign: "center" }}><span title={c.bridged ? "name-bridged across " + c.pns.length + " part numbers" : "single part number"} style={{ fontSize: 10, fontWeight: 700, color: c.bridged ? AMBER : TEAL_L }}>{c.bridged ? "≈ " + c.pns.length + "PN" : "PN"}</span></td>
              <td style={{ ...td, textAlign: "center", fontWeight: c.n > 1 ? 800 : 400, color: c.n > 1 ? LIME : TEXT }}>{c.n}</td>
              <td style={{ ...td, color: MUTE }}>{c.suppliers.length}</td>
              <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.min}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800, color: LIME }}>{c.med}</td>
              <td style={{ ...td, textAlign: "right" }}>{c.avg}</td><td style={{ ...td, textAlign: "right", color: MUTE }}>{c.max}</td>
              <td style={{ ...td, textAlign: "right", color: c.spread > 0 ? RED : MUTE }}>{c.spread || "—"}</td></tr>
            {open === c.key + i && (
              <tr style={{ background: "#082430" }}><td colSpan={11} style={{ padding: "8px 14px", fontSize: 11.5, color: MUTE }}>
                <QuoteLines c={c} /></td></tr>)}
          </React.Fragment>))}</tbody></table></div>
  </>);
}

/* ---------- Analytics: all 8 methods, selectable ---------- */
const METHODS = [
  ["benchmark", "Median benchmark"], ["inflation", "Inflation flagging"], ["confidence", "Confidence scoring"],
  ["dispersion", "Supplier dispersion"], ["trend", "Price trend"], ["agreement", "Cross-source agreement"],
  ["accuracy", "Accuracy validation"], ["normalisation", "Normalisation view"],
];
function Analytics({ parts, clusters, cfg, method, setMethod, inflPct, setInflPct }) {
  return (<>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {METHODS.map(([id, label], i) => (
        <button key={id} onClick={() => setMethod(id)} style={{ padding: "8px 13px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: method === id ? 700 : 500,
          background: method === id ? LIME : "#0F3543", color: method === id ? TEAL_D : MUTE, border: `1px solid ${method === id ? LIME : LINE}` }}>
          <span style={{ fontFamily: "ui-monospace,monospace", opacity: .7, marginRight: 6 }}>{String(i + 1).padStart(2, "0")}</span>{label}</button>))}
    </div>
    {method === "benchmark" && <MBenchmark clusters={clusters} />}
    {method === "inflation" && <MInflation clusters={clusters} inflPct={inflPct} setInflPct={setInflPct} />}
    {method === "confidence" && <MConfidence clusters={clusters} />}
    {method === "dispersion" && <MDispersion clusters={clusters} />}
    {method === "trend" && <MTrend parts={parts} />}
    {method === "agreement" && <MAgreement clusters={clusters} />}
    {method === "accuracy" && <MAccuracy parts={parts} />}
    {method === "normalisation" && <MNormalisation clusters={clusters} />}
  </>);
}
function Head({ children }) { return <p style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.65, marginBottom: 14, maxWidth: 780 }}>{children}</p>; }
function Tbl({ cols, rows }) {
  return <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr style={{ background: PANEL }}>{cols.map((c) => <th key={c.k} style={{ ...th, textAlign: c.a || "left" }}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} style={{ borderTop: `1px solid ${LINE}`, background: r._bg || "transparent" }}>
        {cols.map((c) => <td key={c.k} style={{ ...td, textAlign: c.a || "left", color: c.mut ? MUTE : (r["_c" + c.k] || TEXT), fontFamily: c.mono ? "ui-monospace,monospace" : "inherit", fontWeight: c.b ? 700 : 400 }}>{r[c.k]}</td>)}</tr>)}</tbody></table></div>;
}
function MBenchmark({ clusters }) {
  const [open, setOpen] = useState(null);
  const ready = clusters.filter((c) => c.n > 1);
  const rows = ready.length ? ready : clusters.slice(0, 25);
  const heads = [["Benchmark part","left"],["Make","left"],["Quotes","center"],["Median S$","right"],["Avg S$","right"],["Range S$","right"]];
  return (<><Head>The core reference: median unit price per fuzzy-matched part cluster. Median resists a single inflated bill; average is shown so reviewers can see skew. Only clusters with 2+ quotes give a defensible benchmark. Click a part to see its quotes — each line reads <i>part name · part number · supplier · unit price · bill date</i>, followed by up to two tags: a <b style={{ color: AMBER }}>grade</b> tag (OEM Genuine / OES / Aftermarket / Used-Recon — shown only when the bill states it or a name tag implies it; different known grades never merge into one benchmark) and a <b style={{ color: TEAL_L }}>per pair / per set</b> tag (the line prices two sides or a kit together, so it's kept out of per-each medians). No tags means grade unknown and priced per unit.</Head>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ background: PANEL }}>{heads.map(([h,a]) => <th key={h} style={{ ...th, textAlign: a }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((c, i) => { const id = c.key + i, isOpen = open === id; return (
          <React.Fragment key={id}>
            <tr onClick={() => setOpen(isOpen ? null : id)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: c.n > 1 ? "rgba(195,215,0,.10)" : "transparent" }}>
              <td style={{ ...td, fontWeight: 600 }}><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{c.label}{c.names.length > 1 && <span style={{ color: MUTE, fontWeight: 400 }}> +{c.names.length - 1}</span>}</td>
              <td style={td}>{c.make}</td>
              <td style={{ ...td, textAlign: "center", fontWeight: c.n > 1 ? 800 : 400, color: c.n > 1 ? LIME : TEXT }}>{c.n}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800, color: LIME }}>{c.med}</td>
              <td style={{ ...td, textAlign: "right" }}>{c.avg}</td>
              <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.min}–{c.max}</td></tr>
            {isOpen && <tr style={{ background: "#082430" }}><td colSpan={6} style={{ padding: "8px 14px", fontSize: 11.5, color: MUTE }}><QuoteLines c={c} /></td></tr>}
          </React.Fragment>); })}</tbody></table></div></>);
}
function MInflation({ clusters, inflPct, setInflPct }) {
  const rows = [];
  clusters.filter((c) => c.n > 1).forEach((c) => c.members.forEach((m) => {
    const over = c.med ? ((m.unit - c.med) / c.med) * 100 : 0;
    if (over >= inflPct) rows.push({ part: m.part_name, make: c.make, supplier: m.supplier, quoted: m.unit, med: c.med, over: `+${over.toFixed(0)}%`, _cover: RED, _bg: "rgba(232,97,90,.10)" });
  }));
  return (<><Head>Every quoted line is compared with its cluster median; anything above the threshold is flagged for negotiation. This is the negotiation trigger the brief asks for. On the demo set most matched pairs are identical prices, so few flags appear — volume surfaces the real outliers.</Head>
    <div style={{ marginBottom: 14, fontSize: 12.5 }}>Flag threshold: <b style={{ color: RED }}>+{inflPct}%</b> over median&nbsp;&nbsp;
      <input type="range" min="5" max="100" step="5" value={inflPct} onChange={(e) => setInflPct(+e.target.value)} style={{ width: 220, verticalAlign: "middle" }} /></div>
    {rows.length ? <Tbl cols={[{k:"part",h:"Part"},{k:"make",h:"Make"},{k:"supplier",h:"Supplier"},{k:"quoted",h:"Quoted S$",a:"right"},{k:"med",h:"Median S$",a:"right",mut:1},{k:"over",h:"Over",a:"right",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No lines exceed +{inflPct}% over their cluster median at the current matching setting.</span></Card>}</>);
}
function MConfidence({ clusters }) {
  const now = new Date();
  const score = (c) => {
    const q = Math.min(1, (c.n - 1) / 4);                       // quote depth
    const s = Math.min(1, (c.suppliers.length - 1) / 3);        // supplier diversity
    const ds = c.dates.map(parseDate).filter(Boolean);
    const recency = ds.length ? Math.max(...ds.map((d) => 1 - Math.min(1, (now - d) / (1000*60*60*24*365*3)))) : 0;
    return Math.round((0.4*q + 0.35*s + 0.25*recency) * 100);
  };
  const rows = clusters.filter((c) => c.n > 1).map((c) => { const sc = score(c);
    return { label: c.label, make: c.make, n: c.n, sup: c.suppliers.length, score: sc,
      band: sc >= 60 ? "High" : sc >= 30 ? "Medium" : "Low", _cscore: sc >= 60 ? LIME : sc >= 30 ? AMBER : RED, _cband: sc >= 60 ? LIME : sc >= 30 ? AMBER : RED }; })
    .sort((a, b) => b.score - a.score);
  return (<><Head>Each benchmark is rated on quote depth, supplier diversity and recency (0–100). Insurers lean on high-confidence figures and treat thin ones as indicative. Weights: 40% depth, 35% diversity, 25% recency.</Head>
    {rows.length ? <Tbl cols={[{k:"label",h:"Benchmark part"},{k:"make",h:"Make"},{k:"n",h:"Quotes",a:"center"},{k:"sup",h:"Suppliers",a:"center"},{k:"score",h:"Score",a:"center",b:1},{k:"band",h:"Confidence",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No multi-quote clusters yet — confidence needs 2+ quotes.</span></Card>}</>);
}
function MDispersion({ clusters }) {
  const rows = clusters.filter((c) => c.n > 1 && c.spread > 0).map((c) => ({
    label: c.label, make: c.make, spread: c.spread, pctSpread: c.med ? `${((c.spread / c.med) * 100).toFixed(0)}%` : "—",
    detail: c.members.map((m) => `${m.supplier} S$${m.unit}`).join("  ·  "), _cpctSpread: RED,
  })).sort((a, b) => b.spread - a.spread);
  return (<><Head>Where the same part varies across suppliers, wide spread signals either genuine grade differences (OEM vs aftermarket) or a mispriced supplier — both worth knowing before negotiating.</Head>
    {rows.length ? <Tbl cols={[{k:"label",h:"Part"},{k:"make",h:"Make"},{k:"spread",h:"Spread S$",a:"right",b:1},{k:"pctSpread",h:"% of median",a:"right"},{k:"detail",h:"By supplier",mut:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No price dispersion within clusters at the current setting — matched quotes are identical.</span></Card>}</>);
}
function MTrend({ parts }) {
  const usable = parts.filter((p) => p.ltype === "Supplier Part" && parseDate(p.bill_date));
  const byCat = {};
  usable.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  const cats = Object.entries(byCat).filter(([, a]) => a.length >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const allDates = usable.map((p) => parseDate(p.bill_date));
  const min = Math.min(...allDates), max = Math.max(...allDates), span = max - min || 1;
  return (<><Head>Unit price plotted by bill date, per category, to separate genuine drift from one-off spikes and to keep benchmarks current. Each dot is a part line; the lime marker is the category median.</Head>
    {cats.length ? cats.map(([cat, arr]) => {
      const units = arr.map((p) => p.unit); const umin = Math.min(...units), umax = Math.max(...units), urange = umax - umin || 1; const med = median(units);
      return (<div key={cat} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8 }}>
          <b>{cat}</b><span style={{ color: MUTE }}>{arr.length} lines · S${umin}–{umax} · median S${med.toFixed(0)}</span></div>
        <div style={{ position: "relative", height: 40, background: "#082430", borderRadius: 6 }}>
          {arr.map((p, i) => { const x = ((parseDate(p.bill_date) - min) / span) * 96 + 2; const y = 90 - ((p.unit - umin) / urange) * 80;
            return <div key={i} title={`${p.part_name} S$${p.unit} ${p.bill_date}`} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 7, height: 7, borderRadius: 7, background: TEAL_L, transform: "translate(-50%,-50%)" }} />; })}
        </div></div>); })
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>Not enough dated lines per category to plot a trend yet.</span></Card>}
    <p style={{ color: MUTE, fontSize: 11, marginTop: 4 }}>Time runs left→right across each strip; vertical position is unit price within the category.</p></>);
}
function MAgreement({ clusters }) {
  const rows = clusters.filter((c) => c.suppliers.length > 1).map((c) => {
    const withinTol = c.med ? (c.spread / c.med) <= 0.1 : false;
    return { label: c.label, make: c.make, suppliers: c.suppliers.join(", "), med: c.med, tol: `${c.med ? ((c.spread / c.med) * 100).toFixed(0) : 0}%`,
      verdict: withinTol ? "Agree (≤10%)" : "Diverge", _cverdict: withinTol ? LIME : AMBER, _bg: withinTol ? "rgba(195,215,0,.10)" : "transparent" };
  }).sort((a, b) => (a.verdict > b.verdict ? 1 : -1));
  return (<><Head>When the same part is quoted by independent suppliers at a similar price, that agreement is itself the credibility signal insurers and courts want. Clusters spanning 2+ suppliers within 10% are marked as agreeing.</Head>
    {rows.length ? <Tbl cols={[{k:"label",h:"Part"},{k:"make",h:"Make"},{k:"suppliers",h:"Independent suppliers",mut:1},{k:"med",h:"Median S$",a:"right",b:1},{k:"tol",h:"Spread",a:"right"},{k:"verdict",h:"Verdict",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No cross-supplier clusters yet — needs the same part from 2+ different suppliers.</span></Card>}</>);
}
function MAccuracy({ parts }) {
  // list vs net from estimate lines
  const est = parts.filter((p) => p.doc_type.toLowerCase().includes("estimate") && p.unit && p.total && p.unit !== p.total);
  const byBill = {};
  est.forEach((p) => { (byBill[p.bill_no] = byBill[p.bill_no] || []).push(p); });
  const summ = Object.entries(byBill).map(([bill, arr]) => {
    const list = arr.reduce((s, p) => s + p.unit, 0), net = arr.reduce((s, p) => s + p.total, 0);
    return { bill, supplier: arr[0].supplier, list: list.toFixed(0), net: net.toFixed(0), disc: `${(((list - net) / list) * 100).toFixed(0)}%`, _cdisc: AMBER };
  });
  // cross-source identical PN (all lines)
  const byPN = {}; parts.forEach((p) => { if (p.npn) (byPN[p.npn] = byPN[p.npn] || []).push(p); });
  const matches = Object.values(byPN).filter((a) => new Set(a.map((x) => x.bill_no)).size > 1);
  return (<><Head>To prove value (POC#2) you compare, per claim: supplier-bill cost vs repairer estimate line vs insurer final offer. The sample pairs these on different claims, so we show the two accuracy signals it does contain.</Head>
    <Card title="Signal 1 · List-vs-net margin inside repairer estimates" span="1 / -1">
      {summ.length ? <Tbl cols={[{k:"bill",h:"Estimate"},{k:"supplier",h:"Source"},{k:"list",h:"List S$",a:"right"},{k:"net",h:"Net S$",a:"right"},{k:"disc",h:"Discount",a:"right",b:1}]} rows={summ} />
        : <span style={{ color: MUTE, fontSize: 12.5 }}>No estimate lines with distinct list/net prices in this set.</span>}
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 8 }}>The list-to-net gap is the repairer margin the benchmark is meant to police.</p></Card>
    <div style={{ height: 14 }} />
    <Card title="Signal 2 · Cross-source identical part number" span="1 / -1">
      {matches.length ? matches.map((a, i) => (<div key={i} style={{ fontSize: 12.5, padding: "4px 0" }}>
        <b>{a[0].part_name}</b> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{a[0].part_number}</span>: {a.map((x) => `${x.supplier} S$${x.unit}`).join("  vs  ")}
        {new Set(a.map((x) => x.unit)).size === 1 && <span style={{ color: LIME, fontWeight: 700 }}> — identical price (consistency)</span>}</div>))
        : <span style={{ color: MUTE, fontSize: 12.5 }}>No part number recurs across bills in this set.</span>}
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 8 }}>Full inflation quantification needs matched triples (bill + estimate + final offer) per claim — captured in Extraction #2.</p></Card></>);
}
function MNormalisation({ clusters }) {
  const multi = clusters.filter((c) => c.names.length > 1 || c.pns.length > 1).slice(0, 30);
  return (<><Head>None of the analytics work without collapsing the many ways a part is written into one entity. Below: fuzzy clusters that unified 2+ differently-written names or part numbers — the foundation the whole reference stands on.</Head>
    {multi.length ? <Tbl cols={[{k:"label",h:"Canonical"},{k:"make",h:"Make"},{k:"names",h:"Unified names",mut:1},{k:"pns",h:"Unified part nos",mono:1,mut:1}]}
      rows={multi.map((c) => ({ label: c.label, make: c.make, names: c.names.join("  |  "), pns: c.pns.join("  |  ") }))} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>At the current threshold no cluster merged differing names. Loosen the threshold on the Benchmark tab to see merges.</span></Card>}</>);
}

/* ---------- Assess a claim: match an incoming estimate to the benchmark ---------- */
// Find the best benchmark cluster for one estimate line. Exact normalised part number wins;
// otherwise fuzzy name within the same make (if a make is supplied).
function matchLine(line, clusters, cfg) {
  const npn = normPN(line.part_number || "");
  if (npn) {
    const exact = clusters.find((c) => c.pns.includes(npn));
    if (exact) return { cluster: exact, how: "part number", score: 1 };
  }
  const nm = line.part_name || "";
  if (nm) {
    let best = null, bestScore = 0;
    clusters.forEach((c) => {
      if (line.make && cfg.sameMake && c.make !== "Unknown" && line.make.toLowerCase() !== c.make.toLowerCase()) return;
      const s = Math.max(...c.names.map((n) => similarity(nm, n, cfg.tokenWeight)));
      if (s > bestScore) { bestScore = s; best = c; }
    });
    if (best && bestScore >= cfg.threshold) return { cluster: best, how: "name", score: +bestScore.toFixed(2) };
  }
  return { cluster: null, how: "no match", score: 0 };
}

const SAMPLE_ESTIMATE = `MBA213 906 67 01, HEADLAMP UNIT, 2600
T81130-06590, HEAD LAMP RH, 420
415 885 0205MB, BUMPER REINFORCEMENT FRT, 620
8R2998002, WIPER BLADES, 95
9999-XXX, UNLISTED WIDGET, 300`;

function Assess({ parts, clusters, cfg, inflPct, setInflPct }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [claimRef, setClaimRef] = useState("");

  const run = (raw) => {
    const lines = (raw || text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const out = lines.map((l) => {
      // accept "part_no, name, price" or "part_no | name | price" (make optional 4th)
      const parts = l.split(/\s*[|,\t]\s*/);
      let [pn, name, price, make] = parts;
      // if only 2 fields, assume name, price
      if (parts.length === 2) { pn = ""; name = parts[0]; price = parts[1]; }
      const quoted = parseFloat(String(price || "").replace(/[^\d.]/g, "")) || 0;
      const m = matchLine({ part_number: pn, part_name: name, make }, clusters, cfg);
      const bench = m.cluster ? m.cluster.med : null;
      const over = bench ? +(quoted - bench).toFixed(2) : null;
      const overPct = bench ? +(((quoted - bench) / bench) * 100).toFixed(0) : null;
      const flagged = overPct != null && overPct >= inflPct;
      return { pn: pn || "—", name: name || "—", quoted, bench, over, overPct, how: m.how, score: m.score,
        n: m.cluster ? m.cluster.n : 0, flagged, cluster: m.cluster };
    });
    setRows(out);
  };

  const matched = rows ? rows.filter((r) => r.bench != null) : [];
  const totQuoted = matched.reduce((s, r) => s + r.quoted, 0);
  const totBench = matched.reduce((s, r) => s + r.bench, 0);
  const totOver = matched.reduce((s, r) => s + (r.over > 0 ? r.over : 0), 0);
  const flagged = rows ? rows.filter((r) => r.flagged) : [];

  // The exportable audit trail: line assessment + every underlying supplier
  // quote, stamped with a benchmark snapshot id so the figures are reproducible.
  const exportPack = () => {
    const snap = snapshotId(parts.filter((p) => !p.review), cfg);
    const meta = {
      claimRef: claimRef.trim(), generatedAt: new Date().toLocaleString("en-SG"), appVersion: APP_VERSION,
      snapshotId: snap, invoices: new Set(parts.map((p) => p.bill_no).filter(Boolean)).size,
      usableLines: parts.filter((p) => p.ltype === "Supplier Part" && !p.review).length, inflPct,
    };
    const pack = buildDisputePack(rows, cfg, meta);
    const wb = XLSX.utils.book_new();
    const wsS = XLSX.utils.json_to_sheet(pack.summary); wsS["!cols"] = [{ wch: 30 }, { wch: 90 }];
    const wsL = XLSX.utils.json_to_sheet(pack.lines); wsL["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 11 }, { wch: 26 }, { wch: 15 }, { wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 17 }, { wch: 13 }, { wch: 13 }, { wch: 23 }, { wch: 11 }, { wch: 10 }, { wch: 8 }];
    const wsE = XLSX.utils.json_to_sheet(pack.evidence); wsE["!cols"] = [{ wch: 5 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 11 }, { wch: 12 }, { wch: 9 }, { wch: 12 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, wsS, "Summary");
    XLSX.utils.book_append_sheet(wb, wsL, "Line Assessment");
    XLSX.utils.book_append_sheet(wb, wsE, "Evidence");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `DisputePack_${(claimRef.trim() || "claim").replace(/[^\w-]+/g, "_")}_${stamp}.xlsx`);
  };

  return (<>
    <Card title="Assess an incoming repairer estimate">
      <p style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.6, marginTop: -4 }}>Paste the estimate's parts, one per line as <span style={{ fontFamily: "ui-monospace,monospace", color: TEXT }}>part number, description, quoted price</span> (make optional as a 4th field). Each line is matched to the benchmark — by exact part number first, then by name — and compared against its median. This is the inverse of building the reference: it puts the reference to work on a live claim.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE_ESTIMATE}
        style={{ width: "100%", minHeight: 120, marginTop: 6, background: "#082430", color: TEXT, border: `1px solid ${LINE}`, borderRadius: 8, padding: 11, fontSize: 12.5, fontFamily: "ui-monospace,monospace", outline: "none", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <button onClick={() => run()} style={{ ...btn(LIME, TEAL_D), marginTop: 0 }}>Assess estimate</button>
        <button onClick={() => { setText(SAMPLE_ESTIMATE); run(SAMPLE_ESTIMATE); }} style={{ ...btn(ICE, TEAL_D), marginTop: 0 }}>Try sample</button>
        <span style={{ fontSize: 12.5, color: MUTE, marginLeft: 8 }}>Flag when quoted exceeds median by <b style={{ color: RED }}>+{inflPct}%</b>&nbsp;
          <input type="range" min="5" max="100" step="5" value={inflPct} onChange={(e) => setInflPct(+e.target.value)} style={{ width: 160, verticalAlign: "middle" }} /></span>
        <div style={{ flex: 1 }} />
        <input value={claimRef} onChange={(e) => setClaimRef(e.target.value)} placeholder="Claim ref (optional)" style={{ ...inp(160), marginTop: 0 }} />
        <button onClick={exportPack} disabled={!rows} title={rows ? "Excel: summary + line assessment + every underlying supplier quote, stamped with a benchmark snapshot id" : "Assess an estimate first"}
          style={{ ...btn(rows ? TEAL_L : "#1E4E60", rows ? INK : MUTE), marginTop: 0, cursor: rows ? "pointer" : "not-allowed" }}>Export dispute pack ⬇</button>
      </div>
    </Card>

    {rows && (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, margin: "16px 0" }}>
        {[["Lines assessed", rows.length, "#fff"], ["Matched to benchmark", matched.length, TEAL_L],
          ["Quoted total S$", totQuoted.toFixed(0), "#fff"], ["Benchmark total S$", totBench.toFixed(0), LIME],
          ["Potential over-claim S$", totOver.toFixed(0), totOver > 0 ? RED : LIME], ["Lines flagged", flagged.length, flagged.length ? RED : LIME]]
          .map(([l, v, c]) => (
          <div key={l} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 11, color: MUTE, marginTop: 6 }}>{l}</div></div>))}
      </div>
      <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: PANEL }}>{[["Part no","left"],["Description","left"],["Matched via","left"],["Quotes","center"],["Quoted S$","right"],["Benchmark S$","right"],["Variance S$","right"],["Variance %","right"]].map(([h,a]) => <th key={h} style={{ ...th, textAlign: a }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${LINE}`, background: r.flagged ? "rgba(232,97,90,.12)" : r.bench == null ? "rgba(143,182,196,.06)" : "transparent" }}>
              <td style={{ ...td, fontFamily: "ui-monospace,monospace", color: MUTE }}>{r.pn}</td>
              <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
              <td style={{ ...td, color: r.how === "part number" ? TEAL_L : r.how === "name" ? AMBER : MUTE, fontSize: 11 }}>{r.how}</td>
              <td style={{ ...td, textAlign: "center", color: MUTE }}>{r.n || "—"}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{r.quoted.toFixed(2)}</td>
              <td style={{ ...td, textAlign: "right", color: LIME }}>{r.bench != null ? r.bench.toFixed(2) : "—"}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 700, color: r.over > 0 ? RED : r.over < 0 ? LIME : MUTE }}>{r.over != null ? (r.over > 0 ? "+" : "") + r.over.toFixed(2) : "—"}</td>
              <td style={{ ...td, textAlign: "right", color: r.overPct > 0 ? RED : r.overPct < 0 ? LIME : MUTE }}>{r.overPct != null ? (r.overPct > 0 ? "+" : "") + r.overPct + "%" : "—"}</td></tr>))}</tbody></table></div>
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        {matched.length < rows.length && <span>{rows.length - matched.length} line(s) had no benchmark match (unlisted part or make mismatch) — shown greyed. </span>}
        Potential over-claim sums only the lines quoted above benchmark. Benchmarks marked with few quotes are indicative until more supplier bills accumulate; treat low-sample medians with caution and cross-check the flagged lines against the source bills.
        <b style={{ color: TEXT }}> Export dispute pack</b> produces the attachable audit trail: this assessment plus every underlying supplier quote (supplier, bill no, date, grade, price), stamped with a benchmark <i>snapshot id</i> — same id means same data and same matching settings, so a figure quoted in a negotiation stays reproducible after new bills shift the median.</p>
    </>)}
  </>);
}

function Coverage({ parts, clusters }) {
  const usable = parts.filter((p) => p.ltype === "Supplier Part");
  const catMap = {};
  usable.forEach((p) => { (catMap[p.cat] = catMap[p.cat] || { n: 0 }); catMap[p.cat].n++; });
  const cats = Object.entries(catMap).sort((a, b) => b[1].n - a[1].n);
  const covered = new Set(usable.map((p) => p.make));
  const hit = SG_MAKES.filter((m) => covered.has(m)).length;
  return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
    <Card title={`Make coverage · ${hit}/${SG_MAKES.length} common SG makes`}>
      {SG_MAKES.map((m) => { const n = usable.filter((p) => p.make === m).length;
        return <div key={m} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5, color: n ? TEXT : MUTE }}>
          <span>{m}</span><span style={{ color: n ? LIME : MUTE }}>{n ? `${n} parts` : "— gap"}</span></div>; })}</Card>
    <Card title="Category coverage · usable parts">
      {cats.length ? cats.map(([c, v]) => <div key={c} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
        <span>{c}</span><span style={{ color: MUTE }}>{v.n} parts</span></div>) : <span style={{ color: MUTE, fontSize: 12.5 }}>No data yet.</span>}</Card>
    <div style={{ gridColumn: "1 / -1" }}><Card title="Success criteria (from the project brief)">
      <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
        <b style={{ color: LIME }}>a. Coverage completeness</b> — {hit} of {SG_MAKES.length} common makes and {cats.length} categories; {clusters.filter((c) => c.n > 1).length} fuzzy clusters have a 2+-quote benchmark. Depth grows with invoice volume.<br />
        <b style={{ color: LIME }}>b. Accuracy</b> — benchmark median vs repairer quote vs insurer final offer; see Analytics → Accuracy validation.</div></Card></div>
  </div>);
}
function MethodNotes() {
  const items = [
    ["Median benchmark", "Median unit price per fuzzy-matched cluster; average shown for skew. Median resists a single inflated bill."],
    ["Inflation flagging", "Each quoted line vs its cluster median; configurable % threshold flags outliers for negotiation."],
    ["Confidence scoring", "0–100 per benchmark from quote depth, supplier diversity and recency, so insurers know which figures to trust."],
    ["Supplier dispersion", "Spread of the same part across suppliers — flags grade differences or a mispriced supplier."],
    ["Price trend", "Unit price by bill date per category, separating genuine drift from one-off spikes."],
    ["Cross-source agreement", "Same part from independent suppliers within tolerance — the credibility signal for insurers and courts."],
    ["Accuracy validation", "List-vs-net margins in estimates + cross-source identical-PN matches; full inflation needs matched triples per claim."],
    ["Normalisation view", "The fuzzy clusters that unified differently-written names/part numbers — the foundation everything else stands on."],
  ];
  return (<div>
    <Head>Each method is live under the Analytics tab. These notes summarise what each computes and why it matters for an insurer-grade reference.</Head>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {items.map(([t, d], i) => (<div key={i} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ color: LIME, fontWeight: 800, fontSize: 12, fontFamily: "ui-monospace,monospace" }}>{String(i + 1).padStart(2, "0")}</span>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "#fff" }}>{t}</span></div>
        <div style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.65 }}>{d}</div></div>))}</div>
    <div style={{ marginTop: 18, background: "#082430", border: `1px solid ${LINE}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: LIME }}>Matching: hybrid, part-number-first</div>
      <div style={{ color: TEXT, fontSize: 12.5, lineHeight: 1.75 }}>The benchmark groups by exact normalised <b>part number</b> first — the identifier supplier bills carry that PeerIndex and eSource lack — and only then <i>bridges</i> different part numbers whose names are fuzzy-similar within the same make and model (e.g. OEM vs aftermarket). This keeps genuinely-different parts apart: a Camry headlamp will not merge with a Hilux headlamp. The <b>Basis</b> column marks whether each benchmark rests on a single part number (PN) or a name bridge (≈). Pure fuzzy-name mode is still available, but name-only matching can over-merge, so hybrid is the default. Use the <b style={{ color: LIME }}>Assess a Claim</b> tab to run an incoming repairer estimate against the reference and get a line-by-line variance and total potential over-claim. On a productised site, back this with SQLite: <span style={{ fontFamily: "ui-monospace,monospace", color: TEAL_L }}>suppliers</span>, <span style={{ fontFamily: "ui-monospace,monospace", color: TEAL_L }}>invoices</span>, <span style={{ fontFamily: "ui-monospace,monospace", color: TEAL_L }}>part_lines</span> tables plus a benchmark view; Postgres only for multi-tenant concurrency.</div></div>
  </div>);
}
