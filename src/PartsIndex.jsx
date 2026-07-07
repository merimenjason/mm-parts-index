import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

/* ============================================================
   PartsIndex — SG Motor TP Parts Pricing Reference
   Merimen / Fermion brand palette (petrol-teal + lime accent).
   Benchmark uses CONFIGURABLE FUZZY NAME MATCHING (not exact PN).
   All 8 analysis methods are computed and viewable under Analytics.
   Persistence: browser localStorage by default, or a shared Turso/libSQL DB
   via /api/parts when VITE_DATA_BACKEND=api (see src/datasource.js). The 18-bill
   demo auto-seeds only in the localStorage build; the shared backend starts
   empty (seed it deliberately with `npm run db:seed` or the Load-demo button).
   ============================================================ */

/* ---------- Merimen "Fermion" brand palette ---------- */
const TEAL = "#006E96", TEAL_D = "#00567A", TEAL_L = "#00A0B9";
const LIME = "#C3D700", GREEN = "#2C7837", ICE = "#E1FAFF";
const INK = "#0A2733", PANEL = "#0F3543", LINE = "#1E4E60";
const TEXT = "#EAF6FA", MUTE = "#8FB6C4", RED = "#E8615A", AMBER = "#E8A33D";

const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAPBElEQVR4nL2beZDcR3XHP6+7f3Ps7CmtThvLwsKWLInDZY5Elq0FgjFJMCRBRUKIKZNyMEcowAkFFFkrlaI4iiIVgo2NQ5Fw1iq4gMLEhUOthUwwRhhsZGMQSD6QJdkrrXZnZ3Zmfr9fv/zRv1ntSnvvrL9bW7M7v+N1v3793ve97hZaCFXk3nuxfX0kze/2Pco651hr4aLEc6l6NilsNEKnQgpIeJQcymHgqBEe8p5D1nJ0xHDkdRdTB+jvx2zdiuzeTdqqNstSX6CKACKCb363/2GeL45XuRwvbTR4qQhbO7qI4jp4BZ+GHp8NY8KvdYBCtcKQGH6s8NM05r5d2xmcTe5isCQFDAxgJ4/G4EGucIZ3i+UVuRwbikWoVqDRANUw2gLoDHJFUA0XFcBYbLEE1sLoMGMYHvPKQEP54h9dykmAwUHcrl2kIkyj0rmxaAWoYkVC5/cfYhcJNznH1S7C+RQaDVIFj2IJI7VgWaqoCCkKxuIKRWjUIYkZsobPxvDlqzZzBML02LNn4daw4EZNFrTvIS4zed6fy/EWY6A2Dqrhmghmoe+eDZkyPGCNhbY2qFY4lqR88oTnlt3baPQrZk+whHlbw4IUMDiIazq4+x7lfcbyoWI7q8ojeAlva2mnZ4MqqYuwhQKMlblXYz5w1Yt4sL8fc/PN6HynxLwV0JzvP3iEDUXHv0Y53hDHkCYkCG7RPVkCVPEi+GIbrlZl2Kd88MrtfAENTnI+SpiXAlQxIvgf/pIdUZ4v5QpsqlYm5ttzNuqzILUWay3UG3wuLXBT30ZqZzvp6TBn4w8cIBLB3/cIr7M57jKWTZUx0uzZZe+8iEXEMcdY2SRB45i0VOJdZpyv3/8bOnfvJh0YwM76/tkuNjV47yNc4ywD1tEeN0hFZn9pK9B0J4n3qIKbh0RV1BjStjZcpcJdAn95xRbKs02HGRUwYfaP8drI8g2gK47xrfbu58IAilcFhe72K8jZtQxXvkfqq1mT55zaaVsJWy5zlzb4610vZvRmYM80pGnazgwMYEXw//swLxTly8Ysf+dFLGDw6vGqdJd2sO2Cb7H1/LvYfN5eLlpzS8Ye5+XcbbVC0tXFH5s8HxPBb92LZOxxCs7x3tlN/udH6K7F3GIjemtVUjHLZfaCiCNJY0SglL+Y81d+kNWdb0Ek32wVK9pfv6C3qgYlFPLcuO8gD121jdv6+zPzmiL93AdFBP3ho/xHZxfXj55ers5LJk/xHrpKl7Om629Y233DRMeVlEAghTg5wf2H1gUuPU+ootaCV2pe2HXVJTyQkaWJqSBnPWBE8Psf5Y3GcWeaoIuhsLMhzCLBa4pXaC9s5vwVN7Gy41qc7c3u8pyZncoZBaxdkAIgcIViEVMd50cXFHn1hReGzLLpFM2kG42AHniMXoVPZF53UQnG9Aimnqon8Sn56HwuWvMJXnzhAdZ0vx1ne1GNM5GtczUimHqNpFRixxNV/l4E3bv3jICpPkDQ8V/xjrYSL6hWSFvj9M6YepImlArPZ3XXW1nXfQM5tz5cw2e5bbR0cdNAwcR1NBfx3gcO8fWXvYCnmtbuQuPCP/t+wUaUm+IGPmv5EsxfELF4n6AKhdxa1vW8h1Wdb6YQPT+7J5j67HrW7CeZ5Z45YRoxvrOL9eVRrgf2kFl30wIUQHJcX+qga6y8dLKjKEmSUMj1sqb7es5f8QEiuzpc0wSRuYlk0wkKht+f/HjmDebFA86BEaRaQUV4z0+OcJsIxwFxEBzC4CDtwFtrNXQppi8YvCrGFljf/TbW9byTtvy27KoPnZDZcqdmNis0x+DEyBc5dvoOluSPBUlTtFBgZa3GO4F/UsWYgVCwwKzhzVGODWmS3b5IKZp14IKVH+GitbdknU9pOreZdauoJpnoEClOlu/kl0+9mkPH3o73tSwCLMkvqxhQzxu+u58eyHxAfz/GCrujCE3iUHRY3PsFr57O4mU8b+WHg1cXw1yzKZi6QcThtcZI9V6eOvkxRqv/R+pTrAklpRYEJanVUOe4uHMVLxfhbrdbSO/5BRcnnm1JEujiQmPt5K4AtOW20HSCM89znfhsKujk2Lc4PnwbJ8fuBsAIOGtR9bQiIosgqsQdXeRHTtMH3O0ACjlekS+yulZrDd+f3WMrqukkPyAMle/k+OnbGKncQ+oVaxyapfGqLauAZ9Iw9TqoZ+f+h+kJYRAuK7ZhazViWsJCpjehmUy9XP0pcVrLXB8ISWvp5+Q2KKZWQ23EdpdjvTuo5IYf46K4AdKCdYJJos75nGrqt3Nq7H9QDWsFpcIFdLe9EgVOlr9J4suLDnmzQQRBSdpKtFfKbHJjT3CeKtvrdaBFHDR0VFBtTMrohKHyNzl++jZOV+4hScMcz0UrWNd9I6s630JbfgsAT0YbOXyin8jZLDK0FqqYpAGpcpmTOl3WsCaJ0aU5QGgWKxrpifCf5FE85ep9PD70YcrjPyNOawhQzPWyuuttrO95D/noAgC8ryISUcpvw09NVVoKIVgdngtdaimV2iiUR0hkydXdkFGNVH7AoeM30Fn8Q05Xvs+zo18PS2IeClEnKzv+jPUr3k8pv33iOcUjkkPEodpYYhfnaiWSJiDCFpc06PGFiTrA0l9N6M7Tp77A7/ULiARTt+JYv+LtrOm+jo7iH2T3n0k5BDspeiyXC5wKIziHsNGnLDjPnh2CswbvU4wpsaL9NVzY+y8U85cC888FlgsZH0Bh3Zz15kW8PjgThJUdf8q6nhvpKV0zcXUqB5gJrfX808F7EGGta23oE1TBmhKb1n6O1V3XNcUxYeoyMy0OPMEhkmtdk+aAEUKJqDUIyVBX205Wd12HkmaMLiQ3M0NRjTFZyDw5difWAK3bBzFVWlYrRHnEqXDQRlkrlv5qAJxdAVmVZ/a8qpn6GkQixmoPcmz4Vk6MfBVrWk+Dz5GupE5B07hVUaCJZlFz+uX6JiVuTotafIRjp2/lxPAd1OJhnG09A5wMEVQMosIJFwmnxqucso4Vy1EFngqPqp9wgvX4SZ4e/izPjPwntfhZjEDk3LKwvynQsBVHPY+7Wo5hW+MplymAZQnCk03dMN74Fc+MfJVjw7dQT4ZD2mtsqP0td+cBBHVhDB50PM6QrOG3uRwvatSmFOSXgGD+Id5HnDH1wxwbvpWh0QEqjSdxBpwxWdFzeef7ZHiPZBuVDrm+PpL9j/FQlOPPFXRpwx/mbuKHCaMdwlkw9X/j2dGvMd44hldwphmLfYtJ2BxQfBRhqhWeNp7HHYCPeeDUs9SNJe/9UvxAWFgcqe7j6KlPU8xdQnn8fo6dvpVGcgrvwzJ3b/traS+8jFp8hKHR/0a1NvH8ckPBF0uY8gg/Tdo56gRo1Lm/0MbjuTyX1GtLqQkqIiGr++3xm8I3TYej0Nt5Net6bmRl+7UTT6R+mGdGvktknwPnFxDMX7mvbyM158N2t5F9j/ATES5Bl1Z9bspwNiJNG1hraMtt5nm9H2FlxxsxUgTA+wrGFIlsb7bs/ZzMAx/lsGNlhjTl+wDm5psDdbfC58ereDFLdYKSrfg26Gx7GZvW3splGx9iVedfYaSYjbJOOMfnaNSbaHr/h658IQ+rYsyePXgRdMcWfiKGB11ghYvcfhpyARHHhlUf5YUb7mVt9w3Z+ksIhVP3+yxx9W2hUEzcAAOfb35l4MzaoHo+nQ90fPEKQOksvpwLev950oiHa89pZ8+CKhrlkSTmwMEK3wYQwU8swqsiaZ27y2XuLxZxuqjAHLx4PtqQ/T1X6rv8Xn+SqJAAGT7xd5cTN7fLGAjceO9eTN9LOO2VTyUpDWuD1hYnba7F5aaBPTcWoZ60rR0zXuHHbZ18r7nTHCaxvt27SVUxeoLv1GvcXSgSEsbWNiWbEoEklcfvZ7hyD86wbM5QFY0iiBuMW8tHLz+P6l7ClIdzaa/29ZEYx/sqFZ6JIgyLtoKzEaxCxFGLD/PUyY/x6O+vpREfb9W637QQwReK2EadL+3YzA8GBrC75cz0NmfdrP2K2XkJh1X5RwlXdbrDDXOInSiG6KQdtap1jp76NL984tUcPv4RGukzy9p5VXy+gB0t84tawj/AuadNzvFQe0AHFHsl/Nf+R3hFRxfvGKvQQFlAnSrNFkcCofS+wjOjX+Hoqc9Qrf8aBZxzWcFj+TpvLSZuUMnn+NurLqWSRbspAs910YK+ScP294Pw3uExzu/o4k/KIyTT3n/O43C6Msjw2F3kow2Uaw9w9OQnKdd/HVb+M6a1nARIFXUOtRZfq3Ldju38bHAQJ3Luqu2Mbrh5MOKHv2EVMd/o6OKV5dH5bJ0JTFCBnOuhFg9jpVl2n7lK1DIoXgziHFIb5127tnPLbKdJZo1DzU2Tg0fozsd8o63E1eUyDfVEs2eMIcooHiPLa+pT2uvx1mGcg/Fq6PxcW+bnDMTNs0HfOUBvT4kvt3fw2rFyCJnzUcKyj/iZdvpcDmMs1XqN9+3cwu0DOtXjT4c5Ex8R0v5+zOsvZ0hg9+gwt7sIGzkESGcmS2H1cdkRwoxva8d45XB1lL/YuYXb+/sxb5pHA+ZNxSbvud//K24APl4s0jM+js8ONC37GYKz2qMISeSIjIWkzt21hHe/aju/m3yibS7MO/XNzvSJKrJzC7cnda6s1vhOlMOU2sPK5uKp88KQnRWSri4ihafjGu/fsYVrXrWd32Xeft55zIJyf5FQM+xXTN+LOXjlZq5txLy1UedHpQ5cLhd4jYbzDr6FCvFk000MlEoYIB4b4Y7xBq+54lI+AyFy9fUtbEvpUg5OhpNygt5zgK58G9eI8CFn2WajoNh6DVVIJISEsBIyv3qTJzBQFcBFuCgHcQOSmJpYvpYk/PuurfwcYD7ObiYsLR1TZBBsX0YwBgaw513KVanhncbwImBTdw/UG9CoQRxPnASdSQ2qijiHdREUwr4FyiMMeeUIwret5ys7tvIEtOYwdUvyUVXkZpDJBxF+/DBrGpZdBl4CbMOyVeDC9g5IZzg8bW0olVcrHEN50jgeSxMeFmHfzi387CyZTVq7pGnW8oS8vx+za9fUuTg4SKG4jnWJstIrJREuQuhsHqgG1CgRht95GMLzbGo41beZocltHdAQ2hZ7UHo6/D+XtcbGn9Z/vwAAAABJRU5ErkJggg=="; // Merimen "Fermion" mark (lime f)
const SG_MAKES = ["Toyota","Honda","Mazda","Nissan","Hyundai","Kia","Mercedes-Benz","BMW","Audi",
  "Volkswagen","Mitsubishi","Suzuki","Subaru","Lexus","Mitsubishi Fuso","Porsche","Chevrolet"];

import { DEMO_18 } from "./demoData.js";
import { enrichPart, buildClusters, median, mean, parseDate, GRADES, reconcileInvoice,
  normPN, similarity, snapshotId, buildDisputePack, upgradePart } from "./pipeline.js";
import { OCR_SYS, OCR_USER_TEXT } from "./ocrPrompt.js";
import { loadDataset, saveDataset, usingSharedBackend, loadEvents, appendEvent } from "./datasource.js";

const APP_VERSION = "1.11.0";
const REPO_URL = "https://github.com/merimenjason/mm-parts-index";

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

/* ================= activity log =================
   The Ingest tab's activity history is a persistent, append-only stream of
   structured events. Each event carries a machine timestamp (ISO), a kind, a
   status, and a `detail` blob that the UI expands for drill-down. Persistence
   goes through src/datasource.js (localStorage by default, shared Turso DB when
   VITE_DATA_BACKEND=api), so history survives reloads. */
const KIND_LABEL = { ingest: "Ingest", ocr: "OCR", review: "Review", dataset: "Dataset", error: "Error", info: "Info" };
const STATUS_COLOR = { ok: LIME, warn: AMBER, error: RED, info: TEAL_L };
const ACTIVITY_CAP = 500;
const newEventId = () => {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
const fmtEventTs = (ts) => { const d = new Date(ts); return isNaN(d) ? String(ts || "") : d.toLocaleString("en-SG", { year: "2-digit", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); };

/* ================= persistence =================
   Backed by src/datasource.js, which switches between browser localStorage
   (default) and the shared Turso DB via /api/parts, chosen at build time by
   VITE_DATA_BACKEND. loadDS returns null on first run so the demo is seeded;
   saveDS returns { ok } so a failed shared-backend write can be surfaced. */
async function loadDS() { return loadDataset(); }
async function saveDS(ds) { return saveDataset(ds); }

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
  const [events, setEvents] = useState([]);   // persistent activity log
  const [q, setQ] = useState(""), [fMake, setFMake] = useState("All"), [fType, setFType] = useState("All");
  const [cfg, setCfg] = useState({ mode: "fuzzy-name", threshold: 0.65, sameMake: true, sameModel: false, tokenWeight: 0.6, bridge: false, sepGrade: true, minQuotes: 4 });
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
        setDs(upgraded);
        // Re-persist the migration only for localStorage. With the shared DB the
        // server is the source of truth, so we don't re-POST the whole dataset on
        // every page load (wasteful, and a needless write to the shared reference).
        if (!usingSharedBackend) saveDS(upgraded);
      } else if (usingSharedBackend) {
        // Shared DB (Turso) is empty → start EMPTY. Never auto-seed the demo into a
        // shared dataset: those 174 rows would pollute the reference every other
        // user queries. Real data added via upload/OCR is written to the libSQL DB
        // through saveDS (POST /api/parts). Seed the demo deliberately instead —
        // `npm run db:seed`, or the "Load demo" button on the Ingest tab.
        setDs({ parts: [] });
      } else {
        // Browser-only build (localStorage): seed the 18-bill demo on first run so
        // the dashboard/benchmark are populated immediately for stakeholders.
        const seeded = { parts: DEMO_18.map(enrichPart) };
        setDs(seeded); saveDS(seeded);
      }
    }).catch((e) => {
      // A shared-backend load can fail (network / endpoint down). Start empty and
      // log rather than leaving the app in a broken half-loaded state.
      console.error("dataset load failed:", e);
      setDs({ parts: [] });
    });
  }, []);
  // Load the persisted activity log once on mount. A failure (e.g. shared
  // backend unreachable) leaves the log empty rather than blocking the app.
  useEffect(() => {
    loadEvents().then((evs) => { if (Array.isArray(evs)) setEvents(evs.slice(0, ACTIVITY_CAP)); })
      .catch((e) => console.error("activity load failed:", e));
  }, []);

  const commit = useCallback((next) => { setDs(next); saveDS(next); }, []);

  /* Record a structured activity event: update the in-memory log immediately and
     persist it (fire-and-forget) to the same backend as the dataset. `extra`
     may carry action/source/count/status and a `detail` object for drill-down. */
  const logEvent = useCallback((kind, message, extra = {}) => {
    const ev = {
      id: newEventId(),
      ts: new Date().toISOString(),
      kind,
      action: extra.action || KIND_LABEL[kind] || kind,
      message,
      source: extra.source || "",
      count: extra.count ?? 0,
      status: extra.status || (kind === "error" ? "error" : kind === "warn" ? "warn" : "ok"),
      detail: extra.detail || null,
    };
    setEvents((E) => [ev, ...E].slice(0, ACTIVITY_CAP));
    appendEvent(ev).catch((e) => console.error("activity persist failed:", e));
    return ev;
  }, []);

  const addRaw = (raws, label, extra = {}) => {
    const enr = raws.map(enrichPart);
    commit({ parts: [...ds.parts, ...enr] });
    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    const detail = {
      ...(extra.detail || {}),
      lines: enr.length,
      suppliers: uniq(enr.map((p) => p.supplier)),
      makes: uniq(enr.map((p) => p.make)),
      bills: uniq(enr.map((p) => p.bill_no)),
    };
    logEvent(extra.kind || "ingest", `+${enr.length} parts from ${label}${extra.note ? ` · ${extra.note}` : ""}`, {
      action: extra.action || (extra.kind === "ocr" ? "OCR invoice" : "Excel import"),
      source: label, count: enr.length, status: extra.status || "ok", detail,
    });
  };

  const onExcel = async (e) => {
    const files = [...e.target.files]; if (!files.length) return; setLoading("Reading spreadsheets…");
    try { for (const f of files) { const wb = XLSX.read(await f.arrayBuffer(), { type: "array" }); addRaw(parseExcel(wb), f.name, { kind: "ingest", action: "Excel import" }); } }
    catch (err) { logEvent("error", `Excel error: ${err.message}`, { action: "Excel error", status: "error", detail: { error: err.message } }); } setLoading(null); e.target.value = "";
  };
  const onInvoice = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    for (const f of files) { setLoading(`OCR: ${f.name} · ${ocrModel}…`);
      try { const b64 = await fileToB64(f); const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        const j = await ocrFile(b64, f.type || "image/png", isPdf, ocrModel);
        // Dedup gate: the same supplier+bill_no must never be ingested twice, or its quotes double-count and skew medians.
        const dupKey = `${(j.supplier_name || "").trim().toLowerCase()}|${(j.bill_no || "").trim().toLowerCase()}`;
        if (j.bill_no && ds.parts.some((p) => `${p.supplier.trim().toLowerCase()}|${p.bill_no.trim().toLowerCase()}` === dupKey)) {
          logEvent("ingest", `Skipped ${f.name}: bill ${j.bill_no} from ${j.supplier_name} is already in the dataset (duplicate)`,
            { action: "Duplicate skipped", source: f.name, status: "warn", detail: { bill_no: j.bill_no, supplier: j.supplier_name, model: ocrModel } });
          continue;
        }
        // Reconciliation gate: extracted line sum vs the invoice's own printed subtotal/total.
        const rec = reconcileInvoice(j.parts || [], j);
        const flagged = rec.ok === false;
        const meta = { supplier: j.supplier_name, bill_no: j.bill_no, bill_date: j.bill_date, make: j.make, model: j.model,
          doc_type: j.doc_type, gst: j.gst_treatment,
          review: flagged, review_reason: flagged ? `Extracted lines sum S$${rec.sum} but printed ${rec.basis} is S$${rec.stated} (diff S$${rec.diff}) — lines may be missing or misread` : "" };
        const note = flagged
          ? `⚠ totals do not reconcile (extracted S$${rec.sum} vs printed S$${rec.stated}) — held for review`
          : rec.ok === null
            ? "no printed subtotal/total to reconcile against — spot-check advised"
            : `totals reconcile ✓ (S$${rec.sum} vs printed ${rec.basis})`;
        addRaw((j.parts || []).map((p) => ({ ...p, ...meta, src: "ocr" })), f.name, {
          kind: "ocr", action: "OCR invoice", status: flagged ? "warn" : rec.ok === null ? "info" : "ok", note,
          detail: { model: ocrModel, bill_no: j.bill_no, supplier: j.supplier_name, vehicle_make: j.make, vehicle_model: j.model,
            doc_type: j.doc_type, gst: j.gst_treatment, reconcile: flagged ? "mismatch" : rec.ok === null ? "no basis" : "ok",
            extracted_sum: rec.sum, printed_total: rec.stated, reconcile_basis: rec.basis, reconcile_diff: rec.diff, held_for_review: flagged },
        });
      } catch (err) { logEvent("error", `OCR failed for ${f.name}: ${err.message}`, { action: "OCR failed", source: f.name, status: "error", detail: { model: ocrModel, error: err.message } }); } }
    setLoading(null); e.target.value = "";
  };
  // Review workflow: accept clears the flag (lines join the benchmark); discard removes the bill's lines.
  const acceptBill = (billNo) => { const n = ds.parts.filter((p) => p.bill_no === billNo).length; commit({ parts: ds.parts.map((p) => p.bill_no === billNo ? { ...p, review: false, review_reason: "" } : p) }); logEvent("review", `Accepted bill ${billNo} after review`, { action: "Accept bill", source: `bill ${billNo}`, count: n, status: "ok", detail: { bill_no: billNo, lines: n } }); };
  const discardBill = (billNo) => { const n = ds.parts.filter((p) => p.bill_no === billNo).length; commit({ parts: ds.parts.filter((p) => p.bill_no !== billNo) }); logEvent("review", `Discarded bill ${billNo}`, { action: "Discard bill", source: `bill ${billNo}`, count: n, status: "warn", detail: { bill_no: billNo, lines: n } }); };
  const loadDemo = () => { const seeded = DEMO_18.map(enrichPart); commit({ parts: seeded }); logEvent("dataset", "Loaded demo: 18 sample bills (174 lines)", { action: "Load demo", count: seeded.length, status: "ok", detail: { lines: seeded.length } }); };
  const clearAll = () => { if (window.confirm("Remove all stored parts?")) { const n = ds.parts.length; commit({ parts: [] }); logEvent("dataset", "Dataset cleared", { action: "Clear dataset", count: n, status: "warn", detail: { removed: n } }); } };

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
      Cluster: c.label, Make: c.make, Model: c.modelMixed ? c.models.join(" | ") : (c.model || ""), Category: c.cat, Grade: c.grade, UnitBasis: c.unit_basis, Quotes: c.n, Variants: c.names.join(" | "),
      Suppliers: c.suppliers.join(", "), Min: c.min, Median: c.med, Average: c.avg, Max: c.max,
      IQR_Q1: c.q1 ?? "", IQR_Q3: c.q3 ?? "", SD: Number.isFinite(c.sd) ? c.sd : "", CV_pct: Number.isFinite(c.cv) ? c.cv : "", Reliable: c.n > 1 ? (c.reliable ? "yes" : "no") : "" })) ), "Benchmark");
    XLSX.writeFile(wb, "PartsIndex_export.xlsx");
  };

  const Tab = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ padding: "12px 15px", background: "none", border: "none", cursor: "pointer",
      color: tab === id ? "#fff" : MUTE, fontWeight: tab === id ? 700 : 500, fontSize: 13,
      borderBottom: tab === id ? `3px solid ${LIME}` : "3px solid transparent", letterSpacing: ".02em" }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: INK, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ background: TEAL_D, padding: "16px var(--pi-gutter)", display: "flex", alignItems: "center", gap: 15 }}>
        <img src={LOGO} alt="Merimen" width={34} height={34} style={{ borderRadius: 9, display: "block" }} />
        <div><div style={{ fontSize: 18, fontWeight: 800 }}>PartsIndex</div>
          <div style={{ fontSize: 11, color: "#BFE6EF" }}>Parts Pricing Reference for SG Motor Third-Party Claims</div></div>
        <div style={{ flex: 1 }} />
        {loading
          ? <div style={{ fontSize: 12, color: LIME, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 8, background: LIME, animation: "pulse 1s infinite" }} />{loading}</div>
          : <div style={{ fontSize: 11, color: "#BFE6EF", textAlign: "right" }}>Powered by Merimen Claims Data<br /><span style={{ opacity: .7 }}>fuzzy-matched median benchmark</span>
              <div style={{ marginTop: 5, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                <a href={REPO_URL} target="Github Repository" rel="noopener noreferrer" style={{ color: LIME, textDecoration: "none", fontWeight: 600, fontSize: 11, letterSpacing: ".01em" }}>Github Repository</a>
                <a href={REPO_URL} target="Github Repository" rel="noopener noreferrer" aria-label="Github Repository" title="Github Repository" style={{ display: "inline-flex", alignItems: "center", color: "#BFE6EF" }}>
                  <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                </a>
              </div></div>}
      </div>
      <div style={{ background: TEAL, padding: "0 calc(var(--pi-gutter) - 4px)", display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Tab id="dashboard" label="Dashboard" /><Tab id="demo" label="Demo" /><Tab id="upload" label="Ingest" />
        <Tab id="parts" label="Parts Ledger" /><Tab id="bench" label="Benchmark" />
        <Tab id="assess" label="Assess a Claim" /><Tab id="analytics" label="Analytics" />
        <Tab id="coverage" label="Coverage" /><Tab id="methods" label="Method Notes" />
      </div>

      <div style={{ padding: "var(--pi-gutter)", maxWidth: 1240, margin: "0 auto" }}>
        {tab === "dashboard" && <Dashboard parts={parts} clusters={clusters} kpis={kpis} onDemo={loadDemo} onGo={() => setTab("upload")} />}
        {tab === "demo" && <DemoLookup {...{ clusters, parts, cfg, setCfg }} />}
        {tab === "upload" && <Ingest {...{ excelRef, invRef, onExcel, onInvoice, loadDemo, exportXlsx, clearAll, parts, events, acceptBill, discardBill, ocrModel, setOcrModel }} />}
        {tab === "parts" && <Ledger {...{ q, setQ, fMake, setFMake, fType, setFType, makes, filtered, parts, clusters }} />}
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
// Model display for a cluster: the representative model, with "+N" when a cluster spans several models.
const modelLabel = (c) => (!c.model || c.model === "—") ? "—" : (c.modelMixed ? `${c.model} +${c.models.length - 1}` : c.model);
const modelTitle = (c) => c.modelMixed ? `Spans models: ${c.models.join(", ")}` : undefined;
const inp = (w) => ({ width: w, padding: "9px 11px", background: "#082430", color: TEXT, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, outline: "none" });
const th = { textAlign: "left", padding: "9px 10px", fontSize: 11, color: MUTE, fontWeight: 700, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".04em" };
const td = { padding: "8px 10px", whiteSpace: "nowrap" };
/* Tables carry many nowrap columns; on narrow screens that would push the whole
   page sideways. display:block + overflow-x:auto makes each table scroll WITHIN
   its own card, so the page itself never scrolls horizontally. */
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 12, display: "block", overflowX: "auto", WebkitOverflowScrolling: "touch" };

/* ================= sortable table headers =================
   A tiny, reusable sort layer used by every data table. useSort() holds the
   {key, dir} state and a toggle() that cycles asc→desc on the active column;
   sortRows() returns a sorted COPY (original order preserved when no column is
   chosen, so tables that arrive pre-sorted keep their default until clicked).
   SortTh renders a clickable <th> with a direction indicator. */
function numify(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[,\sS$]/g, "").replace(/^[+≈~]/, "");
  const m = s.match(/^-?\d*\.?\d+/);
  return m ? parseFloat(m[0]) : null;
}
function cmpVals(a, b) {
  const na = numify(a), nb = numify(b);
  if (na != null && nb != null) return na - nb;      // both numeric → numeric order
  if (na != null) return -1;                         // numbers sort before text
  if (nb != null) return 1;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
}
function useSort(initialKey = null, initialDir = "asc") {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });
  const toggle = useCallback((key) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }), []);
  return { sort, toggle, setSort };
}
function sortRows(rows, sort, accessors) {
  if (!sort || !sort.key) return rows;
  const get = accessors && accessors[sort.key] ? accessors[sort.key] : (r) => (r ? r[sort.key] : undefined);
  const out = [...rows].sort((a, b) => cmpVals(get(a), get(b)));
  return sort.dir === "desc" ? out.reverse() : out;
}
function SortTh({ label, sortKey, sort, toggle, align = "left", style }) {
  const active = sort.key === sortKey;
  return (
    <th onClick={() => toggle(sortKey)} title={`Sort by ${label}`}
      style={{ ...th, textAlign: align, cursor: "pointer", userSelect: "none", ...style }}>
      {label}<span style={{ marginLeft: 5, fontSize: 9, color: active ? LIME : "#4B6F80" }}>{active ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  );
}

function Card({ title, children, span }) {
  return <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 14px", gridColumn: span, minWidth: 0 }}>
    {title && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#fff" }}>{title}</div>}{children}</div>;
}
// Shared drill-down: lists the individual quotes behind a benchmark cluster.
// Format: part name · part number · supplier · unit price · bill date, plus two
// optional tags — GRADE (only when known) and PER PAIR / PER SET (only when the
// line doesn't price a single unit). Hover a tag for what it means.
function QuoteLines({ c, showSource }) {
  return (<>{c.members.map((m, k) => (
    <div key={k} style={{ padding: "2px 0" }}>
      <span style={{ color: TEXT }}>{m.part_name}</span> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{m.part_number || "—"}</span>{m.model && m.model !== "—" ? <> · <span style={{ color: MUTE }}>{m.model}</span></> : ""} · {m.supplier} · <b style={{ color: LIME }}>S${m.unit}</b>{m.bill_date ? " · " + m.bill_date : ""}
      {m.grade && m.grade !== "Unknown" && <span title={`Parts grade: ${m.grade} — printed on the bill or inferred from name tags like (ORIGINAL) or (TW). Grade is the biggest legitimate price driver, so quotes of different known grades are never merged into one benchmark.`} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", cursor: "help", color: m.grade === "OEM Genuine" ? LIME : AMBER, border: `1px solid ${m.grade === "OEM Genuine" ? LIME : AMBER}`, borderRadius: 4, padding: "0 4px" }}>{m.grade}</span>}
      {m.unit_basis && m.unit_basis !== "each" && <span title={`This line prices a ${m.unit_basis} (e.g. LH+RH together), not a single unit — per-${m.unit_basis} prices are kept out of per-each medians so they can't skew the benchmark.`} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", cursor: "help", color: TEAL_L, border: `1px solid ${TEAL_L}`, borderRadius: 4, padding: "0 4px" }}>per {m.unit_basis}</span>}
      {showSource && <span style={{ color: MUTE }}> · <span title="The supplier bill this quote was read from">bill {m.bill_no || "—"}</span> · <span style={{ color: m.src === "ocr" ? TEAL_L : "#7FA8B6" }} title={m.src === "ocr" ? "Extracted from the supplier bill by Claude vision OCR" : "Imported from a structured Excel sheet"}>{m.src === "ocr" ? "Claude OCR" : "Excel import"}</span></span>}
    </div>))}</>);
}

/* ---------- Demo: look up a part's benchmark by make/model + name/number + global search ---------- */
const DEMO_RESULT_COLS = [["Part","left","label"],["Make","left","make"],["Model","left","model"],["Category","left","cat"],["Grade","left","grade"],["Quotes","right","n"],["Suppliers","right","sup"],["Median S$","right","med"],["Mean S$","right","avg"],["Range S$","right","range"]];
const DEMO_RESULT_ACC = { label: (c) => c.label, make: (c) => c.make, model: (c) => modelLabel(c), cat: (c) => c.cat, grade: (c) => c.grade, n: (c) => c.n, sup: (c) => c.suppliers.length, med: (c) => c.med, avg: (c) => c.avg, range: (c) => c.min };
const DEMO_WORK_COLS = [["Part","left","label"],["Make","left","make"],["Model","left","model"],["Category","left","cat"],["Quotes","right","n"],["Median S$","right","med"],["Mean S$","right","avg"]];
const DEMO_WORK_ACC = { label: (c) => c.label, make: (c) => c.make, model: (c) => modelLabel(c), cat: (c) => c.cat, n: (c) => c.n, med: (c) => c.med, avg: (c) => c.avg };
function DemoLookup({ clusters, parts, cfg, setCfg }) {
  const [g, setG] = useState("");          // global search
  const [fMake, setFMake] = useState("All");
  const [fModel, setFModel] = useState("All");
  const [fName, setFName] = useState("");  // part name contains
  const [fPN, setFPN] = useState("");      // part number contains
  const [open, setOpen] = useState(null);
  const { sort, toggle } = useSort();                       // results table
  const onSort = (k) => { setOpen(null); toggle(k); };

  const makes = useMemo(() => ["All", ...[...new Set(clusters.map((c) => c.make).filter(Boolean))].sort()], [clusters]);
  const models = useMemo(() => {
    const pool = clusters.filter((c) => fMake === "All" || c.make === fMake);
    return ["All", ...[...new Set(pool.flatMap((c) => c.models))].filter((m) => m && m !== "—").sort()];
  }, [clusters, fMake]);

  const wantPN = normPN(fPN);
  const results = useMemo(() => {
    const terms = g.toLowerCase().split(/\s+/).filter(Boolean);
    return clusters.filter((c) => {
      if (fMake !== "All" && c.make !== fMake) return false;
      if (fModel !== "All" && !c.models.includes(fModel)) return false;
      if (fName && !c.names.some((n) => n.toLowerCase().includes(fName.toLowerCase())) && !c.label.toLowerCase().includes(fName.toLowerCase())) return false;
      if (wantPN && !c.pns.some((p) => p.includes(wantPN)) && !c.rawPns.some((p) => normPN(p).includes(wantPN))) return false;
      if (terms.length) {
        const hay = [c.label, ...c.names, c.make, c.model, ...c.models, c.cat, c.grade, ...c.pns, ...c.rawPns].join(" ").toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    }).sort((a, b) => b.n - a.n || b.med - a.med);
  }, [clusters, g, fMake, fModel, fName, wantPN]);

  const anyFilter = g || fMake !== "All" || fModel !== "All" || fName || fPN;
  const clear = () => { setG(""); setFMake("All"); setFModel("All"); setFName(""); setFPN(""); setOpen(null); };
  const sel = { ...inp("100%"), cursor: "pointer" };

  // Worklist: a user-built shortlist of benchmarks to check, exportable to Excel/PDF.
  const [work, setWork] = useState([]); // ordered cluster keys
  const [openWork, setOpenWork] = useState(null); // expanded worklist row
  const { sort: wsort, toggle: wtoggle } = useSort(); // worklist table
  const onWSort = (k) => { setOpenWork(null); wtoggle(k); };
  const inWork = (c) => work.includes(c.key);
  const toggleWork = (c) => setWork((w) => w.includes(c.key) ? w.filter((k) => k !== c.key) : [...w, c.key]);
  const addAllShown = () => setWork((w) => [...new Set([...w, ...results.map((c) => c.key)])]);
  const workItems = work.map((k) => clusters.find((c) => c.key === k)).filter(Boolean);
  const modelExport = (c) => c.modelMixed ? c.models.join(", ") : (c.model && c.model !== "—" ? c.model : "—");

  const exportWorkExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(workItems.map((c, i) => ({
      "#": i + 1, Part: c.label, Make: c.make, Model: modelExport(c), Category: c.cat, Grade: c.grade,
      Quotes: c.n, Suppliers: c.suppliers.length, "Median S$": c.med, "Mean S$": c.avg, "Min S$": c.min, "Max S$": c.max,
      "IQR Q1 S$": c.q1 ?? "", "IQR Q3 S$": c.q3 ?? "", "SD S$": Number.isFinite(c.sd) ? c.sd : "", "CV %": Number.isFinite(c.cv) ? c.cv : "",
      Reliable: c.n > 1 ? (c.reliable ? "yes" : "no") : "single quote",
    })));
    ws["!cols"] = [{ wch: 4 }, { wch: 26 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 7 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Worklist");
    const ev = [];
    workItems.forEach((c, i) => c.members.forEach((m) => ev.push({
      "#": i + 1, Part: c.label, Make: c.make, Model: m.model && m.model !== "—" ? m.model : "",
      "Evidence part name": m.part_name, "Part number": m.part_number || "", Supplier: m.supplier, "Bill no": m.bill_no,
      "Bill date": m.bill_date || "", Grade: m.grade, "Unit price S$": m.unit, Source: m.src === "ocr" ? "Claude OCR of supplier bill" : "Excel import",
    })));
    const we = XLSX.utils.json_to_sheet(ev);
    we["!cols"] = [{ wch: 4 }, { wch: 24 }, { wch: 15 }, { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, we, "Evidence");
    XLSX.writeFile(wb, "PartsIndex_worklist.xlsx");
  };

  const exportWorkPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(15); doc.setTextColor(0, 110, 150); doc.text("PartsIndex — Benchmark Worklist", 40, 42);
    doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text(`${workItems.length} part${workItems.length === 1 ? "" : "s"} · generated ${new Date().toLocaleString("en-SG")} · Parts Pricing Reference for SG Motor TP Claims`, 40, 60);
    autoTable(doc, {
      startY: 76,
      head: [["#", "Part", "Make", "Model", "Category", "Grade", "Quotes", "Suppliers", "Median S$", "Mean S$", "Range S$"]],
      body: workItems.map((c, i) => [
        String(i + 1), c.label + (c.n > 1 && !c.reliable ? " *" : ""), c.make, modelExport(c), c.cat,
        c.grade !== "Unknown" ? (c.gradeMixed ? "Mixed" : c.grade) : "—",
        String(c.n), String(c.suppliers.length), String(c.med), String(c.avg), `${c.min}-${c.max}`,
      ]),
      styles: { fontSize: 8, cellPadding: 4, lineColor: [220, 220, 220], lineWidth: 0.5 },
      headStyles: { fillColor: [0, 110, 150], textColor: 255, fontStyle: "bold" },
      columnStyles: { 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right", fontStyle: "bold" }, 9: { halign: "right" }, 10: { halign: "right" } },
      alternateRowStyles: { fillColor: [246, 249, 250] },
    });

    // Drill-down evidence: every supplier quote behind each worklisted benchmark.
    const evBody = [];
    workItems.forEach((c, i) => c.members.forEach((m) => evBody.push([
      String(i + 1), c.label, `${m.make || c.make}${m.model && m.model !== "—" ? " " + m.model : ""}`,
      m.supplier, m.bill_no || "—", m.bill_date || "—", m.grade && m.grade !== "Unknown" ? m.grade : "—",
      String(m.unit), m.src === "ocr" ? "Claude OCR" : "Excel",
    ])));
    let y = doc.lastAutoTable.finalY + 22;
    if (y > 500) { doc.addPage(); y = 48; }
    doc.setFontSize(11); doc.setTextColor(0, 110, 150); doc.text("Underlying supplier quotes", 40, y);
    doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text("The evidence behind each benchmark — every quote, with its bill and source (# ties back to the worklist above).", 40, y + 12);
    autoTable(doc, {
      startY: y + 22,
      head: [["#", "Part", "Make / Model", "Supplier", "Bill no", "Date", "Grade", "Unit S$", "Source"]],
      body: evBody,
      styles: { fontSize: 7.5, cellPadding: 3, lineColor: [225, 225, 225], lineWidth: 0.4 },
      headStyles: { fillColor: [0, 110, 150], textColor: 255, fontStyle: "bold" },
      columnStyles: { 7: { halign: "right", fontStyle: "bold" } },
      alternateRowStyles: { fillColor: [246, 249, 250] },
    });
    const endY = doc.lastAutoTable.finalY + 16;
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text("* median from fewer quotes than the reliability floor — indicative only. Prices are per-each unit prices in S$; per-pair / per-set lines are grouped separately.", 40, endY, { maxWidth: 760 });
    doc.save("PartsIndex_worklist.pdf");
  };

  if (!parts.length) return (
    <div style={{ border: `1px dashed ${LINE}`, borderRadius: 12, padding: 44, textAlign: "center", background: PANEL }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff" }}>No parts loaded</div>
      <div style={{ color: MUTE, fontSize: 13, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>Load the demo bills or ingest supplier bills on the Dashboard / Ingest tab, then search the benchmark here.</div>
    </div>);

  return (<>
    <Card title="Look up a part's benchmark price">
      <p style={{ color: MUTE, fontSize: 12.5, lineHeight: 1.6, marginTop: -4 }}>Search the reference by <b style={{ color: TEXT }}>make &amp; model</b>, by <b style={{ color: TEXT }}>part name or number</b>, or with a free-text search across everything. Each match shows the <b style={{ color: LIME }}>median</b> and <b>mean</b> unit price; click a row to see every supplier quote behind it and where it came from.</p>
      <div style={{ marginTop: 12 }}>
        <input value={g} onChange={(e) => setG(e.target.value)} placeholder="🔍  Global search — e.g. “toyota headlamp”, a part number, a supplier…"
          style={{ ...inp("100%"), padding: "11px 13px", fontSize: 13 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 10 }}>
        <label style={{ fontSize: 11.5, color: MUTE }}>Make<br />
          <select value={fMake} onChange={(e) => { setFMake(e.target.value); setFModel("All"); }} style={sel}>{makes.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        <label style={{ fontSize: 11.5, color: MUTE }}>Model<br />
          <select value={fModel} onChange={(e) => setFModel(e.target.value)} style={sel}>{models.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        <label style={{ fontSize: 11.5, color: MUTE }}>Part name contains<br />
          <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. bumper" style={inp("100%")} /></label>
        <label style={{ fontSize: 11.5, color: MUTE }}>Part number contains<br />
          <input value={fPN} onChange={(e) => setFPN(e.target.value)} placeholder="e.g. 52119" style={{ ...inp("100%"), fontFamily: "ui-monospace,monospace" }} /></label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: MUTE }}><b style={{ color: results.length ? LIME : MUTE }}>{results.length}</b> benchmark{results.length === 1 ? "" : "s"} match{anyFilter ? " your filters" : ""}</span>
        {setCfg && cfg && <label style={{ fontSize: 12, color: MUTE, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }} title="A cluster with fewer quotes than this shows its median with a * and its spread as advisory. Shared with the Benchmark tab. Raise it to be stricter about thin data, lower it to treat small clusters as reliable.">
          Min quotes for reliable spread: <b style={{ color: LIME }}>{cfg.minQuotes ?? 4}</b>
          <input type="range" min="1" max="30" step="1" value={cfg.minQuotes ?? 4} onChange={(e) => setCfg({ ...cfg, minQuotes: +e.target.value })} style={{ width: 130 }} /></label>}
        <div style={{ flex: 1 }} />
        {results.length > 0 && <button onClick={addAllShown} style={{ ...btn("transparent", LIME), marginTop: 0, padding: "8px 12px", border: `1px solid ${LIME}` }}>+ Add all shown</button>}
        {anyFilter && <button onClick={clear} style={{ ...btn(ICE, TEAL_D), marginTop: 0, padding: "8px 14px" }}>Clear</button>}
      </div>
    </Card>

    <div style={{ background: PANEL, border: `1px solid ${workItems.length ? LIME : LINE}`, borderRadius: 12, padding: 18, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: workItems.length ? 12 : 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Worklist{workItems.length ? ` · ${workItems.length} part${workItems.length === 1 ? "" : "s"}` : ""}</div>
        <div style={{ flex: 1 }} />
        {workItems.length > 0 && <>
          <button onClick={exportWorkExcel} style={{ ...btn(LIME, TEAL_D), marginTop: 0, padding: "8px 12px" }}>Export Excel</button>
          <button onClick={exportWorkPdf} style={{ ...btn(ICE, TEAL_D), marginTop: 0, padding: "8px 12px" }}>Export PDF</button>
          <button onClick={() => setWork([])} style={{ marginTop: 0, padding: "8px 10px", background: "transparent", color: MUTE, border: `1px solid ${LINE}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Clear</button>
        </>}
      </div>
      {workItems.length === 0
        ? <p style={{ color: MUTE, fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>Build a shortlist of parts to benchmark: click the <b style={{ color: LIME }}>+</b> on any result below to add it here, then export the list to <b>Excel</b> or <b>PDF</b>. Nothing added yet.</p>
        : <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 8 }}>
            <table style={tableStyle}>
              <thead><tr style={{ background: INK }}><th style={th}>#</th>{DEMO_WORK_COLS.map(([h,a,k]) => <SortTh key={k} label={h} sortKey={k} sort={wsort} toggle={onWSort} align={a} />)}<th style={th} /></tr></thead>
              <tbody>{sortRows(workItems, wsort, DEMO_WORK_ACC).map((c, i) => { const wid = c.key + i, wopen = openWork === wid; return (
                <React.Fragment key={wid}>
                  <tr onClick={() => setOpenWork(wopen ? null : wid)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer" }}>
                    <td style={{ ...td, color: MUTE }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}><span style={{ color: LIME, marginRight: 6 }}>{wopen ? "▾" : "▸"}</span>{c.label}{c.n > 1 && !c.reliable ? <span title="Below the reliability floor — indicative only" style={{ color: MUTE }}> *</span> : ""}</td>
                    <td style={td}>{c.make}</td>
                    <td style={{ ...td, color: MUTE }} title={modelTitle(c)}>{modelLabel(c)}</td>
                    <td style={{ ...td, color: MUTE }}>{c.cat}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: c.n > 1 ? 700 : 400, color: c.n > 1 ? LIME : TEXT }}>{c.n}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: LIME }}>{c.med}</td>
                    <td style={{ ...td, textAlign: "right" }}>{c.avg}</td>
                    <td style={{ ...td, textAlign: "center" }} onClick={(e) => e.stopPropagation()}><button onClick={(e) => { e.stopPropagation(); toggleWork(c); }} title="Remove from worklist" style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button></td>
                  </tr>
                  {wopen && <tr style={{ background: "#082430" }}><td colSpan={9} style={{ padding: "10px 14px 12px 26px", fontSize: 11.5, color: MUTE }}>
                    <div style={{ marginBottom: 8, lineHeight: 1.7 }}>
                      <b style={{ color: TEXT }}>{c.label}</b> · {c.make}{c.model && c.model !== "—" ? " " + modelLabel(c) : ""} — <b style={{ color: LIME }}>median S${c.med}</b>, mean S${c.avg}, from <b style={{ color: TEXT }}>{c.n}</b> quote{c.n > 1 ? "s" : ""} across {c.suppliers.length} supplier{c.suppliers.length > 1 ? "s" : ""}. Range S${c.min}–{c.max}{c.n > 1 ? <> · IQR band S${c.q1}–S${c.q3}{Number.isFinite(c.cv) ? ` · CV ${c.cv}%` : ""}</> : ""}.
                      {c.n > 1 && !c.reliable && <span style={{ color: AMBER }}> Thin data — indicative only.</span>}</div>
                    <div style={{ marginBottom: 4, color: TEXT, fontWeight: 600 }}>Source quotes:</div>
                    <QuoteLines c={c} showSource />
                  </td></tr>}
                </React.Fragment>); })}</tbody></table></div>}
    </div>

    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10, marginTop: 16 }}>
      <table style={tableStyle}>
        <thead><tr style={{ background: PANEL }}><th style={{ ...th, textAlign: "center" }}>Add</th>{DEMO_RESULT_COLS.map(([h,a,k]) => <SortTh key={k} label={h} sortKey={k} sort={sort} toggle={onSort} align={a} />)}</tr></thead>
        <tbody>{sortRows(results, sort, DEMO_RESULT_ACC).slice(0, 300).map((c, i) => { const id = c.key + i, isOpen = open === id; return (
          <React.Fragment key={id}>
            <tr onClick={() => setOpen(isOpen ? null : id)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: c.n > 1 ? "rgba(195,215,0,.10)" : "transparent" }}>
              <td style={{ ...td, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); toggleWork(c); }} title={inWork(c) ? "In worklist — click to remove" : "Add to worklist"}
                  style={{ width: 24, height: 24, borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1, fontWeight: 700, border: `1px solid ${inWork(c) ? LIME : LINE}`, background: inWork(c) ? LIME : "transparent", color: inWork(c) ? TEAL_D : LIME }}>{inWork(c) ? "✓" : "+"}</button></td>
              <td style={{ ...td, fontWeight: 600 }}><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{c.label}{c.names.length > 1 && <span style={{ color: MUTE, fontWeight: 400 }}> +{c.names.length - 1}</span>}</td>
              <td style={td}>{c.make}</td><td style={{ ...td, color: MUTE }} title={modelTitle(c)}>{modelLabel(c)}</td><td style={{ ...td, color: MUTE }}>{c.cat}</td>
              <td style={td}>{c.grade !== "Unknown" ? <span style={{ fontSize: 10, fontWeight: 700, color: c.gradeMixed ? RED : c.grade === "OEM Genuine" ? LIME : AMBER }}>{c.gradeMixed ? "Mixed" : c.grade}</span> : <span style={{ color: MUTE }}>—</span>}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: c.n > 1 ? 800 : 400, color: c.n > 1 ? LIME : TEXT }}>{c.n}</td>
              <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.suppliers.length}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800, color: LIME }}>{c.med}{c.n > 1 && !c.reliable ? <span title="Fewer quotes than the reliability floor — indicative only" style={{ color: MUTE }}>*</span> : ""}</td>
              <td style={{ ...td, textAlign: "right" }}>{c.avg}</td>
              <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.min}–{c.max}</td></tr>
            {isOpen && <tr style={{ background: "#082430" }}><td colSpan={11} style={{ padding: "10px 14px 12px 26px", fontSize: 11.5, color: MUTE }}>
              <div style={{ marginBottom: 8, lineHeight: 1.7 }}>
                <b style={{ color: TEXT }}>{c.label}</b> · {c.make}{c.model && c.model !== "—" ? " " + modelLabel(c) : ""} — <b style={{ color: LIME }}>median S${c.med}</b>, mean S${c.avg}, from <b style={{ color: TEXT }}>{c.n}</b> quote{c.n > 1 ? "s" : ""} across {c.suppliers.length} supplier{c.suppliers.length > 1 ? "s" : ""}. Range S${c.min}–{c.max}{c.n > 1 ? <> · IQR band S${c.q1}–S${c.q3}{Number.isFinite(c.cv) ? ` · CV ${c.cv}%` : ""}</> : ""}.
                {c.n > 1 && !c.reliable && <span style={{ color: AMBER }}> Thin data — treat as indicative until more bills accumulate.</span>}
                {c.bridged && <span style={{ color: AMBER }}> · name-bridged across {c.pns.length} part numbers (≈)</span>}</div>
              <div style={{ marginBottom: 4, color: TEXT, fontWeight: 600 }}>Source quotes:</div>
              <QuoteLines c={c} showSource />
            </td></tr>}
          </React.Fragment>); })}
          {!results.length && <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: MUTE, padding: "26px 12px" }}>No benchmark matches these filters. Broaden the search or clear a filter.</td></tr>}
        </tbody></table></div>
    <p style={{ color: MUTE, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>Lime rows have 2+ quotes and give a defensible benchmark; a <b>*</b> on the median flags a cluster below the reliability floor (indicative only). Use the <b style={{ color: LIME }}>+</b> to add a part to your <b>Worklist</b> above — build a shortlist to check, then export it to Excel or PDF. Prices are per-each unit prices; per-pair / per-set lines are grouped separately. Click any row to reveal every underlying supplier quote — supplier, bill number, date, grade and whether it was read by Claude OCR or imported from Excel.</p>
  </>);
}

function Dashboard({ parts, clusters, kpis, onDemo, onGo }) {
  const [openTop, setOpenTop] = useState(null);
  const [openMake, setOpenMake] = useState(null);
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
      <div className="pi-2col">
        <Card title="Coverage vs common SG makes · click a make">
          {SG_MAKES.map((m) => { const items = parts.filter((p) => p.make === m && p.ltype === "Supplier Part"); const n = items.length; const isOpen = openMake === m;
            return (<div key={m}>
              <div onClick={() => n && setOpenMake(isOpen ? null : m)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12.5, cursor: n ? "pointer" : "default" }}>
                <span style={{ width: 120, color: n ? TEXT : MUTE }}>{n ? <span style={{ color: LIME, marginRight: 4 }}>{isOpen ? "▾" : "▸"}</span> : <span style={{ marginRight: 14 }} />}{m}</span>
                <div style={{ flex: 1, height: 7, background: "#0A2C38", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, n * 6)}%`, height: "100%", background: n ? LIME : "transparent" }} /></div>
                <span style={{ width: 28, textAlign: "right", color: MUTE }}>{n || "—"}</span></div>
              {isOpen && <div style={{ padding: "2px 0 8px 18px", fontSize: 11, color: MUTE, maxHeight: 150, overflow: "auto" }}><PartLines items={items} /></div>}
            </div>); })}
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
                  <div style={{ color: MUTE, fontSize: 11, paddingLeft: 16 }} title={modelTitle(c)}>{c.make}{c.model && c.model !== "—" ? " " + modelLabel(c) : ""} · {c.n} quotes · {c.suppliers.length} suppliers · range S${c.min}–{c.max}</div></div>
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
      <span style={{ color: TEXT }}>{m.part_name}</span> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{m.part_number || "—"}</span> · {m.make}{m.model && m.model !== "—" ? " " + m.model : ""}{m.cat ? " · " + m.cat : ""} · {m.supplier} · <b style={{ color: LIME }}>S${(m.unit || 0).toFixed(2)}</b>{m.bill_no ? " · bill " + m.bill_no : ""}
    </div>))}</>);
}
// Table whose rows expand to reveal their member part lines (or custom detail).
// Headers are click-to-sort (asc/desc); sorting a column collapses any open row
// so the expanded detail always matches the row above it.
function ExpandTable({ cols, rows, colSpan }) {
  const [open, setOpen] = useState(null);
  const { sort, toggle } = useSort();
  const onSort = (k) => { setOpen(null); toggle(k); };
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  return (
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={tableStyle}>
        <thead><tr style={{ background: INK }}>{cols.map((c) => <SortTh key={c.k} label={c.h} sortKey={c.k} sort={sort} toggle={onSort} align={c.a || "left"} />)}</tr></thead>
        <tbody>{sorted.map((r, i) => { const isOpen = open === i; return (
          <React.Fragment key={i}>
            <tr onClick={() => setOpen(isOpen ? null : i)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: r._bg || "transparent" }}>
              {cols.map((c, ci) => <td key={c.k} style={{ ...td, textAlign: c.a || "left", color: r["_c" + c.k] || (c.mut ? MUTE : TEXT), fontFamily: c.mono ? "ui-monospace,monospace" : "inherit", fontWeight: c.b ? 700 : 400 }}>
                {ci === 0 && <span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>}{r[c.k]}</td>)}
            </tr>
            {isOpen && <tr style={{ background: INK }}><td colSpan={colSpan || cols.length} style={{ padding: "8px 14px 10px 26px", fontSize: 11.5, color: MUTE }}>{r._detail}</td></tr>}
          </React.Fragment>); })}</tbody></table></div>
  );
}

const READY_COLS = [
  { h: "Benchmark part", k: "label", a: "left", get: (c) => c.label },
  { h: "Make", k: "make", a: "left", get: (c) => c.make },
  { h: "Model", k: "model", a: "left", get: (c) => modelLabel(c) },
  { h: "Quotes", k: "n", a: "center", get: (c) => c.n },
  { h: "Suppliers", k: "sup", a: "center", get: (c) => c.suppliers.length },
  { h: "Median S$", k: "med", a: "right", get: (c) => c.med },
  { h: "Range S$", k: "range", a: "right", get: (c) => c.min },
];
function KpiDetail({ kpi, parts, clusters, onClose }) {
  const [open, setOpen] = useState(null);
  const { sort, toggle } = useSort();
  const onSort = (k) => { setOpen(null); toggle(k); };
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
    const readyAcc = Object.fromEntries(READY_COLS.map((c) => [c.k, c.get]));
    const ready = sortRows(clusters.filter((c) => c.n > 1), sort, readyAcc);
    body = (
      <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
        <table style={tableStyle}>
          <thead><tr style={{ background: INK }}>{READY_COLS.map((c) => <SortTh key={c.k} label={c.h} sortKey={c.k} sort={sort} toggle={onSort} align={c.a} />)}</tr></thead>
          <tbody>{ready.map((c, i) => { const id = c.key + i, isOpen = open === id; return (
            <React.Fragment key={id}>
              <tr onClick={() => setOpen(isOpen ? null : id)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: "rgba(195,215,0,.10)" }}>
                <td style={{ ...td, fontWeight: 600 }}><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{c.label}{c.names.length > 1 && <span style={{ color: MUTE, fontWeight: 400 }}> +{c.names.length - 1}</span>}</td>
                <td style={td}>{c.make}</td>
                <td style={{ ...td, color: MUTE }} title={modelTitle(c)}>{modelLabel(c)}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 800, color: LIME }}>{c.n}</td>
                <td style={{ ...td, textAlign: "center", color: MUTE }}>{c.suppliers.length}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 800, color: LIME }}>{c.med}</td>
                <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.min}–{c.max}</td></tr>
              {isOpen && <tr style={{ background: INK }}><td colSpan={7} style={{ padding: "8px 14px", fontSize: 11.5, color: MUTE }}><QuoteLines c={c} /></td></tr>}
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
function Ingest({ excelRef, invRef, onExcel, onInvoice, loadDemo, exportXlsx, clearAll, parts, events, acceptBill, discardBill, ocrModel, setOcrModel }) {
  // Group flagged lines by bill for the review queue.
  const flaggedBills = useMemo(() => {
    const g = {};
    parts.filter((p) => p.review).forEach((p) => { (g[p.bill_no] ||= { bill_no: p.bill_no, supplier: p.supplier, reason: p.review_reason, lines: [] }).lines.push(p); });
    return Object.values(g);
  }, [parts]);
  return (<div className="pi-2col">
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
    <Card title="Activity" span="1 / -1"><ActivityLog events={events} /></Card>
  </div>);
}

/* Persistent, drill-downable activity log. Each event expands to reveal its full
   timestamp, source, counts, status and a JSON detail blob (reconciliation,
   model used, suppliers/makes/bills touched, …). Persisted via src/datasource.js
   so the history survives reloads and is shared on the Turso backend. */
function ActivityLog({ events }) {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("all");
  const kinds = useMemo(() => ["all", ...[...new Set((events || []).map((e) => e.kind))].filter(Boolean)], [events]);
  const shown = (events || []).filter((e) => filter === "all" || e.kind === filter);
  const chip = (k) => ({ padding: "3px 9px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: filter === k ? 700 : 500,
    background: filter === k ? LIME : "#0F3543", color: filter === k ? TEAL_D : MUTE, border: `1px solid ${filter === k ? LIME : LINE}` });
  return (<div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {kinds.map((k) => <span key={k} onClick={() => setFilter(k)} style={chip(k)}>{k === "all" ? `All (${events?.length || 0})` : (KIND_LABEL[k] || k)}</span>)}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: MUTE }} title="This log is saved and reloads on your next visit; on the shared backend it is visible to every user.">persistent · click a row to drill in</span>
    </div>
    <div style={{ maxHeight: 320, overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 8 }}>
      {shown.length ? shown.map((e, i) => { const id = e.id || i; const isOpen = open === id; const c = STATUS_COLOR[e.status] || MUTE;
        return (<div key={id} style={{ borderTop: i ? `1px solid ${LINE}` : "none" }}>
          <div onClick={() => setOpen(isOpen ? null : id)} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11.5 }}>
            <span style={{ color: LIME, width: 10, flexShrink: 0 }}>{isOpen ? "▾" : "▸"}</span>
            <span style={{ fontFamily: "ui-monospace,monospace", color: MUTE, whiteSpace: "nowrap", flexShrink: 0 }}>{fmtEventTs(e.ts)}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: c, border: `1px solid ${c}`, borderRadius: 4, padding: "0 5px", whiteSpace: "nowrap", flexShrink: 0 }}>{(e.action || KIND_LABEL[e.kind] || e.kind || "").toUpperCase()}</span>
            <span style={{ color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.message}</span>
          </div>
          {isOpen && <div style={{ padding: "2px 10px 10px 28px", fontSize: 11, color: MUTE }}><ActivityDetail e={e} /></div>}
        </div>); })
        : <div style={{ padding: 14, fontSize: 12, color: MUTE }}>No activity{filter === "all" ? " yet" : ` of type "${KIND_LABEL[filter] || filter}"`}.</div>}
    </div>
  </div>);
}

// Key/value drill-down for one activity event.
function ActivityDetail({ e }) {
  const d = new Date(e.ts);
  const Row = ({ k, v }) => (<div style={{ display: "flex", gap: 8, padding: "1px 0", lineHeight: 1.6 }}>
    <span style={{ color: MUTE, width: 130, flexShrink: 0 }}>{k}</span>
    <span style={{ color: TEXT, wordBreak: "break-word" }}>{v}</span></div>);
  const det = e.detail && typeof e.detail === "object" ? e.detail : {};
  return (<div>
    <Row k="Date & time" v={isNaN(d) ? String(e.ts) : d.toLocaleString("en-SG", { hour12: false })} />
    <Row k="Event" v={`${e.action || KIND_LABEL[e.kind] || e.kind}${e.kind ? ` (${e.kind})` : ""}`} />
    <Row k="Status" v={<span style={{ color: STATUS_COLOR[e.status] || MUTE, fontWeight: 700 }}>{e.status}</span>} />
    {e.source ? <Row k="Source" v={e.source} /> : null}
    <Row k="Parts affected" v={e.count ?? 0} />
    {Object.entries(det).map(([k, v]) => (
      <Row key={k} k={k.replace(/_/g, " ")} v={Array.isArray(v) ? (v.length ? v.join(", ") : "—") : (v === null || v === undefined || v === "" ? "—" : String(v))} />
    ))}
  </div>);
}

const LEDGER_COLS = [
  { h: "Make", k: "make", get: (p) => p.make },
  { h: "Model", k: "model", get: (p) => (p.model && p.model !== "—" ? p.model : "") },
  { h: "Category", k: "cat", get: (p) => p.cat },
  { h: "Part name", k: "part_name", get: (p) => p.part_name },
  { h: "Part no", k: "part_number", get: (p) => p.part_number },
  { h: "Grade", k: "grade", get: (p) => p.grade },
  { h: "Qty", k: "qty", a: "center", get: (p) => p.qty },
  { h: "Unit S$", k: "unit", a: "right", get: (p) => p.unit },
  { h: "Total S$", k: "total", a: "right", get: (p) => p.total },
  { h: "Line type", k: "ltype", get: (p) => p.ltype },
  { h: "Supplier", k: "supplier", get: (p) => p.supplier },
];
function Ledger({ q, setQ, fMake, setFMake, fType, setFType, makes, filtered, parts, clusters }) {
  const [open, setOpen] = useState(null);
  const { sort, toggle } = useSort();
  const ledgerAcc = useMemo(() => Object.fromEntries(LEDGER_COLS.map((c) => [c.k, c.get])), []);
  const sortedFiltered = useMemo(() => sortRows(filtered, sort, ledgerAcc), [filtered, sort, ledgerAcc]);
  return (<>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
      <input placeholder="Search part / number / supplier" value={q} onChange={(e) => setQ(e.target.value)} style={inp(240)} />
      <select value={fMake} onChange={(e) => setFMake(e.target.value)} style={inp(160)}>{makes.map((m) => <option key={m}>{m}</option>)}</select>
      <select value={fType} onChange={(e) => setFType(e.target.value)} style={inp(200)}>
        {["All", "Supplier Part", "Consumable / Fastener", "Repair Estimate", "Labour"].map((t) => <option key={t}>{t}</option>)}</select>
      <span style={{ color: MUTE, fontSize: 12.5, alignSelf: "center" }}>{filtered.length} rows · click a line for its full record</span></div>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={tableStyle}>
        <thead><tr style={{ background: PANEL }}>{LEDGER_COLS.map((c) => <SortTh key={c.k} label={c.h} sortKey={c.k} sort={sort} toggle={toggle} align={c.a || "left"} />)}</tr></thead>
        <tbody>{sortedFiltered.slice(0, 400).map((p) => { const isOpen = open === p.id; return (
          <React.Fragment key={p.id}>
            <tr onClick={() => setOpen(isOpen ? null : p.id)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: p.review ? "rgba(232,163,61,.12)" : p.ltype === "Repair Estimate" ? "#3A2226" : p.ltype.startsWith("Consumable") ? "#0C2E3A" : "transparent" }} title={p.review ? p.review_reason : undefined}>
              <td style={td}><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{p.make}</td><td style={{ ...td, color: MUTE }}>{p.model && p.model !== "—" ? p.model : "—"}</td><td style={td}>{p.cat}</td><td style={{ ...td, fontWeight: 600 }}>{p.review && <span style={{ color: AMBER, marginRight: 5 }} title={p.review_reason}>⚠</span>}{p.part_name}</td>
              <td style={{ ...td, fontFamily: "ui-monospace,monospace", color: MUTE }}>{p.part_number}</td>
              <td style={{ ...td, fontSize: 11, color: !p.grade || p.grade === "Unknown" ? MUTE : p.grade === "OEM Genuine" ? LIME : AMBER }}>{!p.grade || p.grade === "Unknown" ? "—" : p.grade}{p.unit_basis && p.unit_basis !== "each" ? " · /" + p.unit_basis : ""}</td>
              <td style={{ ...td, textAlign: "center" }}>{p.qty}</td><td style={{ ...td, textAlign: "right" }}>{p.unit?.toFixed(2)}</td>
              <td style={{ ...td, textAlign: "right" }}>{p.total?.toFixed(2)}</td><td style={{ ...td, color: MUTE }}>{p.ltype}</td><td style={{ ...td, color: MUTE }}>{p.supplier}</td></tr>
            {isOpen && <tr style={{ background: "#082430" }}><td colSpan={11} style={{ padding: "8px 14px 10px 26px", fontSize: 11.5, color: MUTE }}>
              <LedgerDetail p={p} parts={parts} clusters={clusters} /></td></tr>}
          </React.Fragment>); })}</tbody></table>
      {filtered.length > 400 && <div style={{ padding: 10, color: MUTE, fontSize: 12 }}>Showing first 400 of {filtered.length}.</div>}</div>
  </>);
}
// Everything the app knows about one ledger line: the raw record, its bill
// context, and which benchmark (if any) the line feeds.
function LedgerDetail({ p, parts, clusters }) {
  const sib = p.bill_no ? parts.filter((x) => x.bill_no === p.bill_no) : [p];
  const billTotal = sib.reduce((s, x) => s + (x.total || 0), 0);
  const usable = p.ltype === "Supplier Part" && !p.review;
  const c = usable ? clusters.find((cl) => cl.members.some((m) => m.id === p.id)) : null;
  return (<div>
    <div><b style={{ color: TEXT }}>Record</b> — {p.make}{p.model && p.model !== "—" ? " " + p.model : ""} · bill {p.bill_no || "—"}{p.bill_date ? ` · ${p.bill_date}` : ""} · {p.doc_type} · GST {p.gst || "unknown"} · grade {p.grade || "Unknown"} · priced per {p.unit_basis || "each"} · normalised PN <span style={{ fontFamily: "ui-monospace,monospace", color: TEAL_L }}>{p.npn || "—"}</span> · qty {p.qty} × S${(p.unit || 0).toFixed(2)} = S${(p.total || 0).toFixed(2)} · via {p.src === "ocr" ? "Claude OCR" : "Excel import"}
      {p.review && <span style={{ color: AMBER }}> · held for review: {p.review_reason}</span>}</div>
    {sib.length > 1 && <div style={{ marginTop: 6 }}><b style={{ color: TEXT }}>Same bill</b> — {sib.length} lines on bill {p.bill_no} ({p.supplier}) totalling S${billTotal.toFixed(2)}.</div>}
    <div style={{ marginTop: 6 }}>
      {!usable
        ? <span><b style={{ color: TEXT }}>Benchmark</b> — {p.review ? "held for review, so excluded from every benchmark until accepted or discarded on the Ingest tab." : `${p.ltype} lines are excluded from the parts cost benchmark by design.`}</span>
        : c && c.n > 1
          ? <><b style={{ color: TEXT }}>Feeds benchmark</b> — <b style={{ color: LIME }}>{c.label}</b> ({c.make}{c.model && c.model !== "—" ? " " + modelLabel(c) : ""}) · median S${c.med} across {c.n} quotes from {c.suppliers.length} supplier{c.suppliers.length > 1 ? "s" : ""}:
              <div style={{ marginTop: 4 }}><QuoteLines c={c} /></div></>
          : <span><b style={{ color: TEXT }}>Benchmark</b> — sole quote in its cluster at the current matching settings; a defensible median needs a second quote. Loosen the threshold on the Benchmark tab or add more bills.</span>}
    </div>
  </div>);
}

/* ---------- Benchmark with configurable fuzzy matcher ---------- */
const BENCH_COLS = [
  { h: "Benchmark part", k: "label", get: (c) => c.label },
  { h: "Make", k: "make", get: (c) => c.make },
  { h: "Model", k: "model", get: (c) => modelLabel(c) },
  { h: "Category", k: "cat", get: (c) => c.cat },
  { h: "Basis", k: "basis", a: "center", get: (c) => c.pns.length },
  { h: "Quotes", k: "n", a: "center", get: (c) => c.n },
  { h: "Suppliers", k: "suppliers", a: "center", get: (c) => c.suppliers.length },
  { h: "Min", k: "min", a: "right", get: (c) => c.min },
  { h: "Median", k: "med", a: "right", get: (c) => c.med },
  { h: "Avg", k: "avg", a: "right", get: (c) => c.avg },
  { h: "Max", k: "max", a: "right", get: (c) => c.max },
  { h: "Spread", k: "spread", a: "right", get: (c) => c.spread },
  { h: "IQR band", k: "iqr", a: "right", get: (c) => (c.n > 1 ? c.q1 : null) },
];
function Benchmark({ cfg, setCfg, clusters }) {
  const [open, setOpen] = useState(null);
  const { sort, toggle } = useSort();
  const onSort = (k) => { setOpen(null); toggle(k); };
  const benchAcc = useMemo(() => Object.fromEntries(BENCH_COLS.map((c) => [c.k, c.get])), []);
  const sortedClusters = useMemo(() => sortRows(clusters, sort, benchAcc), [clusters, sort, benchAcc]);
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
        <label style={{ fontSize: 12.5 }} title="A cluster with fewer quotes than this shows its IQR band as advisory (marked *), and Assess a Claim will not apply the statistical outlier bound (Q3 + 1.5×IQR) to it. Raise it to be stricter about thin data, lower it to surface bounds sooner.">Min quotes for reliable spread: <b style={{ color: LIME }}>{cfg.minQuotes ?? 4}</b><br />
          <input type="range" min="1" max="30" step="1" value={cfg.minQuotes ?? 4} onChange={(e) => set("minQuotes", +e.target.value)} style={{ width: 150 }} /></label>
      </div>
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}><b style={{ color: LIME }}>Fuzzy part name</b> (the default) clusters parts whose names are similar — good for forming multi-quote medians on a small dataset. <b>Hybrid</b> is the more conservative option: it groups by exact part number first — the identifier supplier bills carry that PeerIndex/eSource lack — and only bridges different part numbers by name when you turn bridging on (bridged rows are marked <b style={{ color: AMBER }}>≈</b> in the <b>Basis</b> column). Use <b>Same make</b>/<b>Same model</b> to stop, say, a Camry headlamp merging with a Hilux one, and the similarity/token sliders to tune name matching. As real volume builds and identical part numbers recur, prefer Hybrid for the most defensible number.</p>
    </Card>
    <p style={{ color: MUTE, fontSize: 12.5, margin: "14px 0", lineHeight: 1.6 }}><b style={{ color: LIME }}>Median</b> is the reference. Lime rows have ≥2 quotes. The <b>IQR band</b> is the middle 50% of quotes (Q1–Q3) — a tight band means the median is well-supported, a wide one means quotes disagree; a <b>*</b> marks a thin cluster (fewer than {cfg.minQuotes ?? 4} quotes) where the spread is only advisory. Click a row to see the grouped quotes.</p>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={tableStyle}>
        <thead><tr style={{ background: PANEL }}>{BENCH_COLS.map((c) => <SortTh key={c.k} label={c.h} sortKey={c.k} sort={sort} toggle={onSort} align={c.a || "left"} />)}</tr></thead>
        <tbody>{sortedClusters.slice(0, 400).map((c, i) => (
          <React.Fragment key={c.key + i}>
            <tr onClick={() => setOpen(open === c.key + i ? null : c.key + i)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: c.n > 1 ? "rgba(195,215,0,.12)" : "transparent" }}>
              <td style={{ ...td, fontWeight: 600 }}>{c.label}{c.names.length > 1 && <span style={{ color: MUTE, fontWeight: 400 }}> +{c.names.length - 1}</span>}
                {c.grade !== "Unknown" && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: c.gradeMixed ? RED : c.grade === "OEM Genuine" ? LIME : AMBER, border: `1px solid ${c.gradeMixed ? RED : c.grade === "OEM Genuine" ? LIME : AMBER}`, borderRadius: 4, padding: "0 4px", verticalAlign: "middle" }} title={c.gradeMixed ? "Cluster mixes grades: " + c.grades.join(", ") + " — median may blend genuine and aftermarket prices" : "All known-grade quotes are " + c.grade}>{c.gradeMixed ? "MIXED GRADE" : c.grade}</span>}</td>
              <td style={td}>{c.make}</td><td style={{ ...td, color: MUTE }} title={modelTitle(c)}>{modelLabel(c)}</td><td style={{ ...td, color: MUTE }}>{c.cat}</td>
              <td style={{ ...td, textAlign: "center" }}><span title={c.bridged ? "name-bridged across " + c.pns.length + " part numbers" : "single part number"} style={{ fontSize: 10, fontWeight: 700, color: c.bridged ? AMBER : TEAL_L }}>{c.bridged ? "≈ " + c.pns.length + "PN" : "PN"}</span></td>
              <td style={{ ...td, textAlign: "center", fontWeight: c.n > 1 ? 800 : 400, color: c.n > 1 ? LIME : TEXT }}>{c.n}</td>
              <td style={{ ...td, color: MUTE }}>{c.suppliers.length}</td>
              <td style={{ ...td, textAlign: "right", color: MUTE }}>{c.min}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800, color: LIME }}>{c.med}</td>
              <td style={{ ...td, textAlign: "right" }}>{c.avg}</td><td style={{ ...td, textAlign: "right", color: MUTE }}>{c.max}</td>
              <td style={{ ...td, textAlign: "right", color: c.spread > 0 ? RED : MUTE }}>{c.spread || "—"}</td>
              <td style={{ ...td, textAlign: "right", color: c.n > 1 ? (c.reliable ? TEXT : MUTE) : MUTE, fontStyle: c.n > 1 && !c.reliable ? "italic" : "normal" }}
                title={c.n > 1 ? `Interquartile range (middle 50% of quotes): S$${c.q1}–S$${c.q3}, IQR S$${c.iqr}.` + (Number.isFinite(c.cv) ? ` CV ${c.cv}%.` : "") + (c.reliable ? "" : ` Only ${c.n} quotes — spread is advisory until ${cfg.minQuotes ?? 4}+.`) : "Needs 2+ quotes"}>
                {c.n > 1 ? `${c.q1}–${c.q3}${c.reliable ? "" : "*"}` : "—"}</td></tr>
            {open === c.key + i && (
              <tr style={{ background: "#082430" }}><td colSpan={13} style={{ padding: "8px 14px", fontSize: 11.5, color: MUTE }}>
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
const MBENCH_COLS = [
  { h: "Benchmark part", k: "label", a: "left", get: (c) => c.label },
  { h: "Make", k: "make", a: "left", get: (c) => c.make },
  { h: "Quotes", k: "n", a: "center", get: (c) => c.n },
  { h: "Median S$", k: "med", a: "right", get: (c) => c.med },
  { h: "Avg S$", k: "avg", a: "right", get: (c) => c.avg },
  { h: "Range S$", k: "range", a: "right", get: (c) => c.min },
];
function MBenchmark({ clusters }) {
  const [open, setOpen] = useState(null);
  const { sort, toggle } = useSort();
  const onSort = (k) => { setOpen(null); toggle(k); };
  const ready = clusters.filter((c) => c.n > 1);
  const base = ready.length ? ready : clusters.slice(0, 25);
  const acc = useMemo(() => Object.fromEntries(MBENCH_COLS.map((c) => [c.k, c.get])), []);
  const rows = useMemo(() => sortRows(base, sort, acc), [base, sort, acc]);
  return (<><Head>The core reference: median unit price per fuzzy-matched part cluster. Median resists a single inflated bill; average is shown so reviewers can see skew. Only clusters with 2+ quotes give a defensible benchmark. Click a part to see its quotes — each line reads <i>part name · part number · supplier · unit price · bill date</i>, followed by up to two tags: a <b style={{ color: AMBER }}>grade</b> tag (OEM Genuine / OES / Aftermarket / Used-Recon — shown only when the bill states it or a name tag implies it; different known grades never merge into one benchmark) and a <b style={{ color: TEAL_L }}>per pair / per set</b> tag (the line prices two sides or a kit together, so it's kept out of per-each medians). No tags means grade unknown and priced per unit.</Head>
    <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <table style={tableStyle}>
        <thead><tr style={{ background: PANEL }}>{MBENCH_COLS.map((c) => <SortTh key={c.k} label={c.h} sortKey={c.k} sort={sort} toggle={onSort} align={c.a} />)}</tr></thead>
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
    if (over >= inflPct) rows.push({ part: m.part_name, make: c.make, model: modelLabel(c), supplier: m.supplier, quoted: m.unit, med: c.med, over: `+${over.toFixed(0)}%`, _cover: RED, _bg: "rgba(232,97,90,.10)",
      _detail: (<div>
        <div style={{ marginBottom: 6 }}>Flagged quote: <b style={{ color: TEXT }}>bill {m.bill_no || "—"}</b>{m.bill_date ? ` · ${m.bill_date}` : ""} · {m.supplier} — <b style={{ color: RED }}>S${m.unit}</b> vs cluster median <b style={{ color: LIME }}>S${c.med}</b> across {c.n} quotes. All quotes in this benchmark:</div>
        <QuoteLines c={c} /></div>) });
  }));
  return (<><Head>Every quoted line is compared with its cluster median; anything above the threshold is flagged for negotiation. This is the negotiation trigger the brief asks for. Click a flagged line to see which bill it came from and every quote behind the median it was judged against. On the demo set most matched pairs are identical prices, so few flags appear — volume surfaces the real outliers.</Head>
    <div style={{ marginBottom: 14, fontSize: 12.5 }}>Flag threshold: <b style={{ color: RED }}>+{inflPct}%</b> over median&nbsp;&nbsp;
      <input type="range" min="5" max="100" step="5" value={inflPct} onChange={(e) => setInflPct(+e.target.value)} style={{ width: 220, verticalAlign: "middle" }} /></div>
    {rows.length ? <ExpandTable cols={[{k:"part",h:"Part"},{k:"make",h:"Make"},{k:"model",h:"Model",mut:1},{k:"supplier",h:"Supplier"},{k:"quoted",h:"Quoted S$",a:"right"},{k:"med",h:"Median S$",a:"right",mut:1},{k:"over",h:"Over",a:"right",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No lines exceed +{inflPct}% over their cluster median at the current matching setting.</span></Card>}</>);
}
function MConfidence({ clusters }) {
  const now = new Date();
  const scoreParts = (c) => {
    const q = Math.min(1, (c.n - 1) / 4);                       // quote depth
    const s = Math.min(1, (c.suppliers.length - 1) / 3);        // supplier diversity
    const ds = c.dates.map(parseDate).filter(Boolean);
    const recency = ds.length ? Math.max(...ds.map((d) => 1 - Math.min(1, (now - d) / (1000*60*60*24*365*3)))) : 0;
    return { q, s, recency, total: Math.round((0.4*q + 0.35*s + 0.25*recency) * 100) };
  };
  const Bar = ({ label, frac, weight, why }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0" }}>
      <span style={{ width: 150, color: TEXT }}>{label} <span style={{ color: MUTE }}>× {weight}</span></span>
      <div style={{ flex: 1, maxWidth: 220, height: 7, background: "#0A2C38", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ width: `${frac * 100}%`, height: "100%", background: frac >= 0.6 ? LIME : frac >= 0.3 ? AMBER : RED }} /></div>
      <span style={{ width: 110, color: MUTE }}>{(frac * weight * 100).toFixed(0)} / {weight * 100} pts</span>
      <span style={{ color: MUTE }}>{why}</span></div>);
  const rows = clusters.filter((c) => c.n > 1).map((c) => { const sc = scoreParts(c);
    const ds = c.dates.map(parseDate).filter(Boolean).sort((a, b) => b - a);
    const cvBand = !Number.isFinite(c.cv) ? "—" : c.cv < 10 ? "tight" : c.cv < 25 ? "moderate" : "wide";
    const cvCol = cvBand === "wide" ? RED : cvBand === "moderate" ? AMBER : cvBand === "tight" ? LIME : MUTE;
    return { label: c.label, make: c.make, model: modelLabel(c), n: c.n, sup: c.suppliers.length, score: sc.total,
      spread: Number.isFinite(c.cv) ? `${c.cv}% ${cvBand}` : "—", _cspread: cvCol,
      band: sc.total >= 60 ? "High" : sc.total >= 30 ? "Medium" : "Low", _cscore: sc.total >= 60 ? LIME : sc.total >= 30 ? AMBER : RED, _cband: sc.total >= 60 ? LIME : sc.total >= 30 ? AMBER : RED,
      _detail: (<div>
        <div style={{ marginBottom: 6 }}>How the score of <b style={{ color: TEXT }}>{sc.total}</b> is built (0–100):</div>
        <Bar label="Quote depth" frac={sc.q} weight={0.40} why={`${c.n} quotes — full marks at 5+`} />
        <Bar label="Supplier diversity" frac={sc.s} weight={0.35} why={`${c.suppliers.length} supplier${c.suppliers.length > 1 ? "s" : ""} — full marks at 4+`} />
        <Bar label="Recency" frac={sc.recency} weight={0.25} why={ds.length ? `newest quote ${ds[0].toLocaleDateString("en-SG")} — decays to zero over 3 years` : "no dated quotes"} />
        <div style={{ margin: "8px 0 4px", color: MUTE }}>Companion signal — price agreement: IQR band <b style={{ color: TEXT }}>S${c.q1}–S${c.q3}</b>, coefficient of variation <b style={{ color: cvCol }}>{Number.isFinite(c.cv) ? c.cv + "% (" + cvBand + ")" : "n/a"}</b>. A high score with a wide CV means plenty of quotes that disagree on price — trust the depth, but expect to negotiate within a range rather than to a point.</div>
        <div style={{ margin: "8px 0 4px" }}>The quotes behind it:</div>
        <QuoteLines c={c} /></div>) }; })
    .sort((a, b) => b.score - a.score);
  return (<><Head>Each benchmark is rated on quote depth, supplier diversity and recency (0–100). Insurers lean on high-confidence figures and treat thin ones as indicative. Weights: 40% depth, 35% diversity, 25% recency. The <b>Price spread</b> column is a separate signal — the coefficient of variation (SD ÷ mean) — showing how much the quotes behind a confident median actually agree. Click a row to see exactly how its score is built and the quotes behind it.</Head>
    {rows.length ? <ExpandTable cols={[{k:"label",h:"Benchmark part"},{k:"make",h:"Make"},{k:"model",h:"Model",mut:1},{k:"n",h:"Quotes",a:"center"},{k:"sup",h:"Suppliers",a:"center"},{k:"score",h:"Score",a:"center",b:1},{k:"spread",h:"Price spread",a:"center"},{k:"band",h:"Confidence",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No multi-quote clusters yet — confidence needs 2+ quotes.</span></Card>}</>);
}
function MDispersion({ clusters }) {
  const rows = clusters.filter((c) => c.n > 1 && c.spread > 0).map((c) => {
    const lo = c.members.reduce((a, b) => (a.unit <= b.unit ? a : b));
    const hi = c.members.reduce((a, b) => (a.unit >= b.unit ? a : b));
    const cvBand = !Number.isFinite(c.cv) ? "—" : c.cv < 10 ? "tight" : c.cv < 25 ? "moderate" : "wide";
    return {
      label: c.label, make: c.make, model: modelLabel(c), spread: c.spread, pctSpread: c.med ? `${((c.spread / c.med) * 100).toFixed(0)}%` : "—",
      iqr: `${c.q1}–${c.q3}`, sd: Number.isFinite(c.sd) ? c.sd : "—", cv: Number.isFinite(c.cv) ? `${c.cv}%` : "—",
      summary: `${lo.supplier} S$${lo.unit} → ${hi.supplier} S$${hi.unit}`, _cpctSpread: RED,
      _ccv: cvBand === "wide" ? RED : cvBand === "moderate" ? AMBER : LIME,
      _detail: (<div>
        <div style={{ marginBottom: 6 }}>Widest gap: <b style={{ color: LIME }}>{lo.supplier} S${lo.unit}</b>{lo.bill_no ? ` (bill ${lo.bill_no})` : ""} vs <b style={{ color: RED }}>{hi.supplier} S${hi.unit}</b>{hi.bill_no ? ` (bill ${hi.bill_no})` : ""} — spread S${c.spread} on a median of S${c.med}.</div>
        <div style={{ marginBottom: 6 }}>Robust measures: interquartile range <b style={{ color: TEXT }}>S${c.q1}–S${c.q3}</b> (IQR S${c.iqr}), standard deviation <b style={{ color: TEXT }}>{Number.isFinite(c.sd) ? "S$" + c.sd : "n/a"}</b>, coefficient of variation <b style={{ color: cvBand === "wide" ? RED : cvBand === "moderate" ? AMBER : LIME }}>{Number.isFinite(c.cv) ? c.cv + "% (" + cvBand + ")" : "n/a"}</b>{c.reliable ? "" : <span style={{ color: AMBER }}> — only {c.n} quotes, below the reliability floor; treat as advisory</span>}.
          {c.grades.filter((g) => g !== "Unknown").length > 1
            ? <span style={{ color: AMBER }}> Grades differ across these quotes — the spread may be a legitimate OEM-vs-aftermarket difference rather than a mispricing.</span>
            : " Same known grade (or grade unknown) throughout — worth querying the dearer supplier."}</div>
        <QuoteLines c={c} /></div>),
    };
  }).sort((a, b) => b.spread - a.spread);
  return (<><Head>Where the same part varies across suppliers, wide spread signals either genuine grade differences (OEM vs aftermarket) or a mispriced supplier. Alongside the raw min–max spread, the <b>IQR</b> (middle-50% band) and <b>SD</b> resist a single outlier, and the <b>CV</b> (SD ÷ median) makes spread comparable across cheap and expensive parts — under 10% is tight, over 25% is wide. Click a row for the full breakdown and every quote behind it.</Head>
    {rows.length ? <ExpandTable cols={[{k:"label",h:"Part"},{k:"make",h:"Make"},{k:"model",h:"Model",mut:1},{k:"spread",h:"Spread S$",a:"right",b:1},{k:"iqr",h:"IQR band S$",a:"right"},{k:"sd",h:"SD S$",a:"right"},{k:"cv",h:"CV",a:"right",b:1},{k:"pctSpread",h:"% of median",a:"right"},{k:"summary",h:"Cheapest → dearest",mut:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No price dispersion within clusters at the current setting — matched quotes are identical.</span></Card>}</>);
}
function MTrend({ parts }) {
  const [openCat, setOpenCat] = useState(null);
  const usable = parts.filter((p) => p.ltype === "Supplier Part" && parseDate(p.bill_date));
  const byCat = {};
  usable.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  const cats = Object.entries(byCat).filter(([, a]) => a.length >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const allDates = usable.map((p) => parseDate(p.bill_date));
  const min = Math.min(...allDates), max = Math.max(...allDates), span = max - min || 1;
  return (<><Head>Unit price plotted by bill date, per category, to separate genuine drift from one-off spikes and to keep benchmarks current. Each dot is a part line (hover it for details); click a category strip to list its lines in date order.</Head>
    {cats.length ? cats.map(([cat, arr]) => {
      const units = arr.map((p) => p.unit); const umin = Math.min(...units), umax = Math.max(...units), urange = umax - umin || 1; const med = median(units);
      const isOpen = openCat === cat;
      return (<div key={cat} style={{ background: PANEL, border: `1px solid ${isOpen ? LIME : LINE}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
        <div onClick={() => setOpenCat(isOpen ? null : cat)} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8, cursor: "pointer" }}>
          <b><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{cat}</b><span style={{ color: MUTE }}>{arr.length} lines · S${umin}–{umax} · median S${med.toFixed(0)}</span></div>
        <div style={{ position: "relative", height: 40, background: "#082430", borderRadius: 6 }}>
          {arr.map((p, i) => { const x = ((parseDate(p.bill_date) - min) / span) * 96 + 2; const y = 90 - ((p.unit - umin) / urange) * 80;
            return <div key={i} title={`${p.part_name} · ${p.make}${p.model && p.model !== "—" ? " " + p.model : ""} · S$${p.unit} · ${p.bill_date}`} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 7, height: 7, borderRadius: 7, background: TEAL_L, transform: "translate(-50%,-50%)" }} />; })}
        </div>
        {isOpen && <div style={{ marginTop: 10, fontSize: 11, color: MUTE, maxHeight: 200, overflow: "auto" }}>
          {arr.slice().sort((a, b) => parseDate(a.bill_date) - parseDate(b.bill_date)).map((p, i) => (
            <div key={i} style={{ padding: "2px 0" }}>
              <span style={{ fontFamily: "ui-monospace,monospace" }}>{p.bill_date}</span> · <span style={{ color: TEXT }}>{p.part_name}</span> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{p.part_number || "—"}</span> · {p.make}{p.model && p.model !== "—" ? " " + p.model : ""} · {p.supplier} · <b style={{ color: p.unit === umax && umin !== umax ? RED : p.unit === umin && umin !== umax ? LIME : TEXT }}>S${p.unit}</b>{p.bill_no ? ` · bill ${p.bill_no}` : ""}
            </div>))}
          <div style={{ marginTop: 4, color: MUTE }}>Dearest line in red, cheapest in lime — the strip above shows the same lines positioned by date (left→right) and price (low→high).</div>
        </div>}
      </div>); })
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>Not enough dated lines per category to plot a trend yet.</span></Card>}
    <p style={{ color: MUTE, fontSize: 11, marginTop: 4 }}>Time runs left→right across each strip; vertical position is unit price within the category.</p></>);
}
function MAgreement({ clusters }) {
  const rows = clusters.filter((c) => c.suppliers.length > 1).map((c) => {
    const pct = c.med ? (c.spread / c.med) * 100 : 0;
    const withinTol = c.med ? (c.spread / c.med) <= 0.1 : false;
    return { label: c.label, make: c.make, model: modelLabel(c), suppliers: c.suppliers.join(", "), med: c.med, tol: `${pct.toFixed(0)}%`,
      verdict: withinTol ? "Agree (≤10%)" : "Diverge", _cverdict: withinTol ? LIME : AMBER, _bg: withinTol ? "rgba(195,215,0,.10)" : "transparent",
      _detail: (<div>
        <div style={{ marginBottom: 6 }}>{c.suppliers.length} independent suppliers quote this part between <b style={{ color: TEXT }}>S${c.min}</b> and <b style={{ color: TEXT }}>S${c.max}</b> — spread S${c.spread} is <b style={{ color: withinTol ? LIME : AMBER }}>{pct.toFixed(0)}%</b> of the S${c.med} median, {withinTol ? "within" : "outside"} the 10% agreement tolerance.
          {withinTol ? " Independent sources arriving at the same price is the credibility signal a disputed figure needs." : <span style={{ color: AMBER }}> Check the quotes below for a grade or per-pair difference before treating the divergence as a mispricing.</span>}</div>
        <QuoteLines c={c} /></div>) };
  }).sort((a, b) => (a.verdict > b.verdict ? 1 : -1));
  return (<><Head>When the same part is quoted by independent suppliers at a similar price, that agreement is itself the credibility signal insurers and courts want. Clusters spanning 2+ suppliers within 10% are marked as agreeing. Click a row for the arithmetic and the quotes from each supplier.</Head>
    {rows.length ? <ExpandTable cols={[{k:"label",h:"Part"},{k:"make",h:"Make"},{k:"model",h:"Model",mut:1},{k:"suppliers",h:"Independent suppliers",mut:1},{k:"med",h:"Median S$",a:"right",b:1},{k:"tol",h:"Spread",a:"right"},{k:"verdict",h:"Verdict",b:1}]} rows={rows} />
      : <Card><span style={{ color: MUTE, fontSize: 12.5 }}>No cross-supplier clusters yet — needs the same part from 2+ different suppliers.</span></Card>}</>);
}
function MAccuracy({ parts }) {
  const [openMatch, setOpenMatch] = useState(null);
  // list vs net from estimate lines
  const est = parts.filter((p) => p.doc_type.toLowerCase().includes("estimate") && p.unit && p.total && p.unit !== p.total);
  const byBill = {};
  est.forEach((p) => { (byBill[p.bill_no] = byBill[p.bill_no] || []).push(p); });
  const summ = Object.entries(byBill).map(([bill, arr]) => {
    const list = arr.reduce((s, p) => s + p.unit, 0), net = arr.reduce((s, p) => s + p.total, 0);
    return { bill, supplier: arr[0].supplier, list: list.toFixed(0), net: net.toFixed(0), disc: `${(((list - net) / list) * 100).toFixed(0)}%`, _cdisc: AMBER,
      _detail: (<div>
        <div style={{ marginBottom: 6 }}>Line-by-line list price vs net (what the repairer actually pays) in this estimate:</div>
        {arr.map((p, i) => { const d = p.unit ? (((p.unit - p.total) / p.unit) * 100).toFixed(0) : 0;
          return (<div key={i} style={{ padding: "2px 0" }}>
            <span style={{ color: TEXT }}>{p.part_name}</span> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{p.part_number || "—"}</span> · list <b style={{ color: TEXT }}>S${p.unit}</b> → net <b style={{ color: LIME }}>S${p.total}</b> · <b style={{ color: AMBER }}>−{d}%</b>
          </div>); })}</div>) };
  });
  // cross-source identical PN (all lines)
  const byPN = {}; parts.forEach((p) => { if (p.npn) (byPN[p.npn] = byPN[p.npn] || []).push(p); });
  const matches = Object.values(byPN).filter((a) => new Set(a.map((x) => x.bill_no)).size > 1);
  return (<><Head>To prove value (POC#2) you compare, per claim: supplier-bill cost vs repairer estimate line vs insurer final offer. The sample pairs these on different claims, so we show the two accuracy signals it does contain. Click an estimate for its line-by-line list-vs-net, or a cross-source match for the bills behind it.</Head>
    <Card title="Signal 1 · List-vs-net margin inside repairer estimates" span="1 / -1">
      {summ.length ? <ExpandTable cols={[{k:"bill",h:"Estimate"},{k:"supplier",h:"Source"},{k:"list",h:"List S$",a:"right"},{k:"net",h:"Net S$",a:"right"},{k:"disc",h:"Discount",a:"right",b:1}]} rows={summ} />
        : <span style={{ color: MUTE, fontSize: 12.5 }}>No estimate lines with distinct list/net prices in this set.</span>}
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 8 }}>The list-to-net gap is the repairer margin the benchmark is meant to police.</p></Card>
    <div style={{ height: 14 }} />
    <Card title="Signal 2 · Cross-source identical part number" span="1 / -1">
      {matches.length ? matches.map((a, i) => { const isOpen = openMatch === i; return (
        <div key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
          <div onClick={() => setOpenMatch(isOpen ? null : i)} style={{ fontSize: 12.5, padding: "6px 0", cursor: "pointer" }}>
            <span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>
            <b>{a[0].part_name}</b> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{a[0].part_number}</span>: {a.map((x) => `${x.supplier} S$${x.unit}`).join("  vs  ")}
            {new Set(a.map((x) => x.unit)).size === 1 && <span style={{ color: LIME, fontWeight: 700 }}> — identical price (consistency)</span>}</div>
          {isOpen && <div style={{ padding: "0 0 8px 18px", fontSize: 11, color: MUTE }}>
            <div style={{ marginBottom: 4 }}>The same normalised part number seen on {new Set(a.map((x) => x.bill_no)).size} different bills — the strongest form of cross-source validation, no fuzzy matching involved:</div>
            {a.map((x, k) => (<div key={k} style={{ padding: "2px 0" }}>
              <span style={{ color: TEXT }}>{x.part_name}</span> · <span style={{ fontFamily: "ui-monospace,monospace" }}>{x.part_number}</span> · {x.make}{x.model && x.model !== "—" ? " " + x.model : ""} · {x.supplier} · bill {x.bill_no || "—"}{x.bill_date ? ` · ${x.bill_date}` : ""} · <b style={{ color: LIME }}>S${x.unit}</b> · {x.doc_type}
            </div>))}</div>}
        </div>); })
        : <span style={{ color: MUTE, fontSize: 12.5 }}>No part number recurs across bills in this set.</span>}
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 8 }}>Full inflation quantification needs matched triples (bill + estimate + final offer) per claim — captured in Extraction #2.</p></Card></>);
}
function MNormalisation({ clusters }) {
  const multi = clusters.filter((c) => c.names.length > 1 || c.pns.length > 1).slice(0, 30);
  return (<><Head>None of the analytics work without collapsing the many ways a part is written into one entity. Below: fuzzy clusters that unified 2+ differently-written names or part numbers — the foundation the whole reference stands on. Click a row to inspect the merge: every underlying line with its exact spelling, part number, supplier and price, so an over-merge is spotted before it corrupts a benchmark.</Head>
    {multi.length ? <ExpandTable cols={[{k:"label",h:"Canonical"},{k:"make",h:"Make"},{k:"model",h:"Model",mut:1},{k:"names",h:"Unified names",mut:1},{k:"pns",h:"Unified part nos",mono:1,mut:1}]}
      rows={multi.map((c) => ({ label: c.label, make: c.make, model: modelLabel(c), names: c.names.join("  |  "), pns: c.pns.join("  |  "),
        _detail: (<div>
          <div style={{ marginBottom: 6 }}>{c.names.length} spelling{c.names.length > 1 ? "s" : ""} and {c.pns.length} part number{c.pns.length > 1 ? "s" : ""} merged into one benchmark{c.bridged ? <span style={{ color: AMBER }}> — spans multiple part numbers (name-bridged ≈), so verify these really are the same part</span> : " — same normalised part number throughout"}. The lines as written on the bills:</div>
          <QuoteLines c={c} /></div>) }))} />
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
  let best = null, bestScore = 0;
  if (nm) {
    clusters.forEach((c) => {
      if (line.make && cfg.sameMake && c.make !== "Unknown" && line.make.toLowerCase() !== c.make.toLowerCase()) return;
      const s = Math.max(...c.names.map((n) => similarity(nm, n, cfg.tokenWeight)));
      if (s > bestScore) { bestScore = s; best = c; }
    });
    if (best && bestScore >= cfg.threshold) return { cluster: best, how: "name", score: +bestScore.toFixed(2) };
  }
  // No match — but keep the nearest rejected candidate so the UI can explain WHY.
  return { cluster: null, how: "no match", score: 0, near: best ? { label: best.label, make: best.make, model: modelLabel(best), score: +bestScore.toFixed(2) } : null };
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
  const [openRow, setOpenRow] = useState(null);
  const { sort, toggle } = useSort();
  const onSort = (k) => { setOpenRow(null); toggle(k); };

  const run = (raw) => {
    const lines = (raw || text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const out = lines.map((l, idx) => {
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
      // Tukey upper fence: statistically defensible outlier bound (Q3 + 1.5·IQR).
      // Only meaningful on a reliable cluster (n ≥ the configurable floor, cfg.minQuotes).
      const uf = m.cluster && m.cluster.reliable && Number.isFinite(m.cluster.upperFence) ? m.cluster.upperFence : null;
      const aboveFence = uf != null && quoted > uf;
      return { _id: idx, pn: pn || "—", name: name || "—", quoted, bench, over, overPct, how: m.how, score: m.score, near: m.near || null,
        n: m.cluster ? m.cluster.n : 0, flagged, uf, aboveFence, cluster: m.cluster };
    });
    setRows(out);
    setOpenRow(null);
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
    const wsL = XLSX.utils.json_to_sheet(pack.lines); wsL["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 11 }, { wch: 26 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 11 }, { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 17 }, { wch: 13 }, { wch: 18 }, { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 23 }, { wch: 11 }, { wch: 10 }, { wch: 8 }];
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
          ["Potential over-claim S$", totOver.toFixed(0), totOver > 0 ? RED : LIME], ["Lines flagged", flagged.length, flagged.length ? RED : LIME],
          ["Above IQR bound", rows.filter((r) => r.aboveFence).length, rows.some((r) => r.aboveFence) ? RED : LIME]]
          .map(([l, v, c]) => (
          <div key={l} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 11, color: MUTE, marginTop: 6 }}>{l}</div></div>))}
      </div>
      <div style={{ overflow: "auto", border: `1px solid ${LINE}`, borderRadius: 10 }}>
        <table style={tableStyle}>
          <thead><tr style={{ background: PANEL }}>{[["Part no","left","pn"],["Description","left","name"],["Matched via","left","how"],["Quotes","center","n"],["Quoted S$","right","quoted"],["Benchmark S$","right","bench"],["Variance S$","right","over"],["Variance %","right","overPct"],["Stat. bound","center","aboveFence"]].map(([h,a,k]) => <SortTh key={k} label={h} sortKey={k} sort={sort} toggle={onSort} align={a} />)}</tr></thead>
          <tbody>{sortRows(rows, sort).map((r) => { const isOpen = openRow === r._id; return (
            <React.Fragment key={r._id}>
              <tr onClick={() => setOpenRow(isOpen ? null : r._id)} style={{ borderTop: `1px solid ${LINE}`, cursor: "pointer", background: r.flagged ? "rgba(232,97,90,.12)" : r.bench == null ? "rgba(143,182,196,.06)" : "transparent" }}>
                <td style={{ ...td, fontFamily: "ui-monospace,monospace", color: MUTE }}><span style={{ color: LIME, marginRight: 6, fontFamily: "'Inter',system-ui,sans-serif" }}>{isOpen ? "▾" : "▸"}</span>{r.pn}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                <td style={{ ...td, color: r.how === "part number" ? TEAL_L : r.how === "name" ? AMBER : MUTE, fontSize: 11 }}>{r.how}</td>
                <td style={{ ...td, textAlign: "center", color: MUTE }}>{r.n || "—"}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{r.quoted.toFixed(2)}</td>
                <td style={{ ...td, textAlign: "right", color: LIME }}>{r.bench != null ? r.bench.toFixed(2) : "—"}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: r.over > 0 ? RED : r.over < 0 ? LIME : MUTE }}>{r.over != null ? (r.over > 0 ? "+" : "") + r.over.toFixed(2) : "—"}</td>
                <td style={{ ...td, textAlign: "right", color: r.overPct > 0 ? RED : r.overPct < 0 ? LIME : MUTE }}>{r.overPct != null ? (r.overPct > 0 ? "+" : "") + r.overPct + "%" : "—"}</td>
                <td style={{ ...td, textAlign: "center" }}>{r.bench == null ? <span style={{ color: MUTE }}>—</span>
                  : r.aboveFence ? <span style={{ fontSize: 9.5, fontWeight: 700, color: RED, border: `1px solid ${RED}`, borderRadius: 4, padding: "1px 5px" }} title={`Quoted S$${r.quoted.toFixed(2)} exceeds the upper Tukey fence S$${r.uf} (Q3 + 1.5×IQR) across ${r.n} benchmark quotes — above the statistical range of observed prices, not merely above the median. A repairer can dispute a percentage; this is much harder to argue with.`}>ABOVE BOUND</span>
                  : r.uf != null ? <span style={{ color: MUTE, fontSize: 11 }} title={`Within the statistical range — upper bound is S$${r.uf} (Q3 + 1.5×IQR).`}>within</span>
                  : <span style={{ color: MUTE, fontSize: 11 }} title={`Fewer than ${cfg.minQuotes ?? 4} quotes — statistical bound not reliable at this sample size.`}>n/a</span>}</td></tr>
              {isOpen && <tr style={{ background: "#082430" }}><td colSpan={9} style={{ padding: "8px 14px 10px 26px", fontSize: 11.5, color: MUTE }}>
                {r.cluster ? (<div>
                  <div style={{ marginBottom: 6 }}>Matched via <b style={{ color: r.how === "part number" ? TEAL_L : AMBER }}>{r.how}</b>{r.how === "name" ? ` (similarity ${r.score} ≥ threshold ${cfg.threshold})` : " — exact normalised part number, the strongest possible match"} to benchmark <b style={{ color: TEXT }}>{r.cluster.label}</b> ({r.cluster.make}{r.cluster.model && r.cluster.model !== "—" ? " " + modelLabel(r.cluster) : ""}{r.cluster.bridged ? <span style={{ color: AMBER }}> · name-bridged ≈</span> : ""}) — median <b style={{ color: LIME }}>S${r.cluster.med}</b> from {r.cluster.n} quote{r.cluster.n > 1 ? "s" : ""} across {r.cluster.suppliers.length} supplier{r.cluster.suppliers.length > 1 ? "s" : ""}, range S${r.cluster.min}–{r.cluster.max}, IQR band <b style={{ color: TEXT }}>S${r.cluster.q1}–S${r.cluster.q3}</b>{r.uf != null ? <> · statistical upper bound <b style={{ color: TEXT }}>S${r.uf}</b> (Q3 + 1.5×IQR)</> : <span style={{ color: MUTE }}> · statistical bound n/a (under {cfg.minQuotes ?? 4} quotes)</span>}. {r.aboveFence && <b style={{ color: RED }}>This line sits above the statistical upper bound — an outlier against the observed price range, not just above the median, and the strongest basis to dispute. </b>}This is the evidence the dispute pack exports:</div>
                  <QuoteLines c={r.cluster} /></div>)
                : (<div>No benchmark matched this line, so it is excluded from the totals. {r.near
                    ? <>The closest candidate was <b style={{ color: TEXT }}>{r.near.label}</b> ({r.near.make}{r.near.model && r.near.model !== "—" ? " " + r.near.model : ""}) at similarity <b style={{ color: AMBER }}>{r.near.score}</b> — below the {cfg.threshold} threshold. If that is actually the same part, loosen the threshold on the Benchmark tab or add the part number to the estimate line.</>
                    : "No candidate cluster could be compared — the part is not in the reference yet, or the make constraint filtered everything out."}</div>)}
              </td></tr>}
            </React.Fragment>); })}</tbody></table></div>
      <p style={{ color: MUTE, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        {matched.length < rows.length && <span>{rows.length - matched.length} line(s) had no benchmark match (unlisted part or make mismatch) — shown greyed. </span>}
        Click any result row to see its match evidence — the quotes behind the benchmark it was compared to — or, for unmatched lines, the closest rejected candidate and why it fell short.
        Potential over-claim sums only the lines quoted above benchmark. Benchmarks marked with few quotes are indicative until more supplier bills accumulate; treat low-sample medians with caution and cross-check the flagged lines against the source bills.
        <b style={{ color: TEXT }}> Export dispute pack</b> produces the attachable audit trail: this assessment plus every underlying supplier quote (supplier, bill no, date, grade, price), stamped with a benchmark <i>snapshot id</i> — same id means same data and same matching settings, so a figure quoted in a negotiation stays reproducible after new bills shift the median.</p>
    </>)}
  </>);
}

function Coverage({ parts, clusters }) {
  const [openMake, setOpenMake] = useState(null);
  const [openCat, setOpenCat] = useState(null);
  const usable = parts.filter((p) => p.ltype === "Supplier Part");
  const catMap = {};
  usable.forEach((p) => { (catMap[p.cat] = catMap[p.cat] || []).push(p); });
  const cats = Object.entries(catMap).sort((a, b) => b[1].length - a[1].length);
  const covered = new Set(usable.map((p) => p.make));
  const hit = SG_MAKES.filter((m) => covered.has(m)).length;
  return (<div className="pi-2col">
    <Card title={`Make coverage · ${hit}/${SG_MAKES.length} common SG makes · click a make for its parts`}>
      {SG_MAKES.map((m) => { const items = usable.filter((p) => p.make === m); const n = items.length; const isOpen = openMake === m;
        return (<div key={m} style={{ borderBottom: `1px solid ${LINE}` }}>
          <div onClick={() => n && setOpenMake(isOpen ? null : m)} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5, color: n ? TEXT : MUTE, cursor: n ? "pointer" : "default" }}>
            <span>{n ? <span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span> : <span style={{ marginRight: 16 }} />}{m}</span>
            <span style={{ color: n ? LIME : MUTE }}>{n ? `${n} parts` : "— gap"}</span></div>
          {isOpen && <div style={{ padding: "2px 0 8px 16px", fontSize: 11, color: MUTE, maxHeight: 170, overflow: "auto" }}><PartLines items={items} /></div>}
        </div>); })}</Card>
    <Card title="Category coverage · usable parts · click a category for its parts">
      {cats.length ? cats.map(([c, items]) => { const isOpen = openCat === c;
        return (<div key={c} style={{ borderBottom: `1px solid ${LINE}` }}>
          <div onClick={() => setOpenCat(isOpen ? null : c)} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5, cursor: "pointer" }}>
            <span><span style={{ color: LIME, marginRight: 6 }}>{isOpen ? "▾" : "▸"}</span>{c}</span><span style={{ color: MUTE }}>{items.length} parts</span></div>
          {isOpen && <div style={{ padding: "2px 0 8px 16px", fontSize: 11, color: MUTE, maxHeight: 170, overflow: "auto" }}><PartLines items={items} /></div>}
        </div>); }) : <span style={{ color: MUTE, fontSize: 12.5 }}>No data yet.</span>}</Card>
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
    <Head>Each method is live under the Analytics tab. These notes summarise what each computes and why it matters for an insurer-grade reference. Every view drills down: click any row (or trend strip) to open the evidence behind the number — the individual quotes with supplier, bill, date, grade and price — because a reference an adjuster can't verify is a reference they won't defend.</Head>
    <div className="pi-2col" style={{ gap: 14 }}>
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
