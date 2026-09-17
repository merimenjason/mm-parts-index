# PartsIndex — QA & data-validity findings

**Run date:** 17 September 2026 · **Dataset:** live shared reference, 1,536 part
lines / 252 invoices · **App version:** 1.17.2

This document records the data-validity exercise requested in the *Parts Ref
Database Discussion* review call (16 September 2026). The ask was specific:

> "before we explore other statistical means to display it for our users, we
> should do data validity because we have no knowledge in total parts … you can
> do sampling and verify whether there's outlier values"

The concern behind it was a headlamp benchmark spanning S$85–3,600 — whether
such a range means the data is dirty, or whether it is real market variance.

**The short answer: neither.** The spread is not bad data and it is not the
market. It is that a fuzzy-name cluster contains *different parts*. That
conclusion is supported below, and two hypotheses that sounded more likely were
tested and rejected.

---

## 1. How much of the reference can actually produce a benchmark

| | |
| --- | --- |
| Part lines in the shared reference | 1,536 |
| Clusters formed (default config) | 949 |
| **Clusters meeting the 4-quote floor** | **45** |
| Part lines inside those clusters | **271 (17.6%)** |

Roughly **82% of the reference cannot price anything** at `minQuotes: 4`. This
is the first number to state in any presentation, because it frames every other
figure. It is not a defect — it is what 252 invoices of a long-tail parts market
looks like — but it must not be discovered by the audience.

Of those 45 clusters:

| Property | Clusters |
| --- | --- |
| Single supplier only | 9 |
| Every quote at an identical price | 8 |
| Drawn from ≤2 distinct bills | 3 |
| max/min ≥ 5× | 7 |
| CV ≥ 50% | 10 |

---

## 2. Rejected hypothesis: "the spread is model mixing"

The Toyota headlamp cluster (14 quotes, S$185–3,600) pools a Dyna, a Corolla, a
Hiace, a Sienta and a Harrier-class LED unit. `cfg.sameModel` is off by default,
so this looked like the obvious cause.

**It was tested and it is not.** Forcing `sameModel` on:

| Configuration | Clusters | Lines | % of data | Median CV | Median max/min |
| --- | --- | --- | --- | --- | --- |
| sameModel **off** (default) | 45 | 271 | 17.6% | 30% | 2.29× |
| sameModel **on** | 22 | 111 | 7.2% | 31% | 2.24× |
| sameModel on, minQuotes 3 | 46 | 183 | 11.9% | 28% | 1.82× |

Coverage halves — 271 lines down to 111 — and the ranges **do not tighten**
(2.29× → 2.24×, CV 30% → 31%). That is a catastrophic trade for no measurable
gain.

The reason is that `modelKey()` folds every blank model to `"—"`, and model is
missing on most lines:

| Of the 45 reference clusters | |
| --- | --- |
| Span more than one named model | 23 (51%) |
| Contain ≥1 line with no model at all | 40 (89%) |
| Have no model on any line | 8 |

So `sameModel` splits apart the few correctly-labelled lines while leaving the
large unlabelled bucket mixed exactly as before.

Grouping the clusters by how well they are labelled settles it — if model mixing
drove spread, fully-labelled clusters would be the *tightest*:

| Group | Clusters | Lines | Median max/min | Median CV |
| --- | --- | --- | --- | --- |
| Every line has a named model | 5 | 23 | **2.50×** | 45% |
| Mixed named/blank | 32 | 210 | **1.92×** | 28% |
| No line has a model | 8 | 38 | **3.07×** | 41% |

They are the *widest*. And within the fully-named group, single-model clusters
spread **more** (3.63×) than multi-model ones (2.50×). Small samples, but firmly
the wrong direction for the hypothesis.

**Conclusion: do not turn `sameModel` on, and do not invest in model capture as
a way to tighten benchmarks.** Model is still worth capturing for filtering and
display — just not for this.

---

## 3. Rejected hypothesis: "the spread is supplier competition"

If the tool's premise is that a benchmark reveals over-charging, then most of a
cluster's spread should sit *between* suppliers. Decomposing the 21 clusters
where at least two suppliers each quoted twice or more:

| | |
| --- | --- |
| Median **between**-supplier spread | **1.25×** |
| Median **within**-supplier spread | **1.27×** |

They are the same. Supplier identity explains essentially none of the variance.

The cleanest test is the same part number quoted by different suppliers — 46
such part numbers exist in the reference:

> **Median price ratio for an identical part number across suppliers: 1.00×**

Suppliers agree almost exactly when you can prove they are quoting the same
thing. The handful of exceptions are informative rather than noisy:

```
1.67x  T81130-37660  HEADLAMP               $270 Fortuna  vs  $450 He Xing (5 days apart)
2.00x  T53112-26070  FRT BUMPER LWR GRILLE
2.38x  H76841-T5A003 Washer Tank
```

---

## 4. What the spread actually is

Combining sections 2 and 3: within a cluster, the price range is driven neither
by model nor by supplier. It is driven by the cluster containing genuinely
different parts that share a similar name.

This produces the **central tension to put in front of the product team**:

- **Where a part number matches, the market is tight (1.00×) and the benchmark
  is trustworthy.** But only 46 part numbers are shared across suppliers, so
  exact-part-number matching covers roughly 3% of the reference.
- **Where matching falls back to the part name, coverage is far better but the
  cluster is no longer guaranteed to be one part**, and the median inherits that.

That is the real product decision — high confidence on a sliver, or broad
coverage with a caveat — and it is a better discussion to lead with than a
defence of individual outliers.

---

## 5. LH/RH and pair-vs-single

Raised on the call: fuzzy matching ignores whether a line is the left or right
part, and an invoice may bill a pair as one line.

**LH/RH merging is empirically safe.** Of the 45 reference clusters, 17 mix left
and right. Comparing the LH median against the RH median inside each:

| | |
| --- | --- |
| Median LH-vs-RH difference | **4.1%** |
| Clusters within 10% | 12 of 17 |
| Clusters differing by >30% | 2 |

Both outliers (Toyota Fender 66%, Honda Headlamp 33%) also mix models, so the
gap is not attributable to the side. Separating LH from RH would **halve every
cluster to correct a ~4% error** — unaffordable at 45 qualifying clusters.
`cfg.sepSide` should stay off by default, and this measurement is the
justification.

**Pair-vs-single remains a genuine open risk.** Only **1 line in 271** carries
`qty > 1`, so a bill charging for both headlamps on one line is
indistinguishable from one lamp. The S$3,600 Toyota headlamp is recorded as
qty 1. There is currently no signal in the data that would let the app detect
this, and a pair priced against a single-unit benchmark produces a false
over-claim — the worst failure mode the tool has.

---

## 6. Categorisation — narrower than first thought

An initial pass suggested fasteners were widely contaminating assembly
benchmarks. Checked properly, only **4 lines** across all assembly clusters are
priced below 20% of their own cluster median:

```
  $5 / $120   Mercedes-Benz  COVER BUMPER               MBA000 991 36 04
 $25 / $436   Tesla          ASSEMBLY - FENDER SUPPORT  1771986-SC-C
 $25 / $436   Tesla          ASSEMBLY - FENDER SUPPORT  1771936-SC-C
 $25 / $436   Tesla          ASSEMBLY - FENDER SUPPORT  1771936-SC-C
```

The v1.17.0 two-tier `COMPONENT_RULES` / `ASSEMBLY_RULES` work is holding:
plugs, treenails, expansion rivets and plastic nuts all categorise correctly.

One worthwhile addition: a **`*_SUPPORT` / `* SUPPORT`** component rule, which
would pull the Tesla fender brackets out of the fender benchmark.

A tempting shortcut that does **not** work: inferring "this is hardware" from a
Mercedes `000`-series part number. That prefix also holds a Distance Sensor
($95), a Coolant Pump ($420) and the star badge ($90).

---

## 7. OCR accuracy — a separate track

Per the call, OCR reliability is a distinct concern from benchmark accuracy
("we do two separate processes… it's more of a bug fixing thing"). Two concrete
classes of error are visible in the current reference.

**Single-character part-number misreads.** 14 pairs of part numbers differ by
exactly one character while carrying an identical part name — almost certainly
one part read two ways. Each split pair costs a cluster one quote.

```
T52131-26020I  vs  T52131-260201   FRT BUMPER REINF    ← letter I / digit 1
B57702SJ000    vs  S57702SJ000     FRT BUMPER          ← B / S
MBA213 880 0018 vs MBA213 880 0118  Front Fender
1771986-SC-C   vs  1771936-SC-C    FENDER SUPPORT      ← 9 / 3
```

**Field bleed between rows.** The S$120 "COVER BUMPER" line in the Mercedes
front-bumper cluster carries part number `MBA003 990 94 97` — a blind rivet,
priced at S$4–5 elsewhere on the same supplier's bills. The rivet's number was
read into the bumper's row.

Both are prompt/QA work, not matcher work.

---

## 8. Bugs found and fixed during this exercise

**`parseDate` misread slash-separated ISO dates.** 15 live lines print
`2025/07/31`. The D/M/Y branch matched first, reading day 2025, month 07,
year 31, which rolled over to **25 July 2031** — six years in the future. Those
bills survived every recency window and sorted as the newest quote in their
cluster. Fixed in v1.17.2; the ISO branch now accepts `-` or `/` and runs first.

**`n` counts lines, not independent observations.** Eight of the 45 reference
clusters have every quote at an identical price — typically a single-channel
manufacturer's price list re-quoted across several bills. Tesla's headlamp
benchmark reads as 6 quotes of S$1,741; it is one price observed six times.

Applying a genuine independence test — **≥2 suppliers, ≥4 distinct bills, and
more than one distinct price** — leaves **24 of 45 clusters (165 lines)**. This
is recommended as the basis for the `reliable` flag, in place of a raw count.
*(Not yet implemented.)*

---

## 9. External price validation

Attempted per the call's suggestion to sanity-check ranges against public
pricing. **This arm is weak and should not be leaned on:** Singapore aftermarket
parts pricing is poorly indexed, and US-market results are not comparable
(different variants, no GST, different channel margins).

The one reasonably clean comparison:

| Part | Reference | Public (US) |
| --- | --- | --- |
| Tesla Model 3 headlamp assembly `1760888-00-F` | S$1,741 | ~US$987–1,000 (≈S$1,270–1,290) new from Tesla |

About 35% higher, which GST plus Singapore channel margin plausibly covers —
though ours is the ECE variant rather than the US part, so it is not
like-for-like.

On the call, a live check of a Toyota headlamp returned roughly US$50–1,200 for
a single lamp (≈S$65–1,560), doubling for a pair — which does cover the
reference range and supports the conclusion that the headlamp figures are not
absurd.

**Recommendation:** treat public-price checking as a spot sanity test only.
Comparing against the separately-extracted internal dataset offered on the call
is a far stronger validation and should replace this.

---

## 10. Open items

| Item | Status |
| --- | --- |
| `parseDate` slash-ISO | **Fixed** (v1.17.2) |
| Supplier-independence reliability floor | Recommended, not implemented |
| `*_SUPPORT` component rule | Recommended, not implemented |
| Pair-vs-single detection | **Open — no signal in the data** |
| Model capture | Low priority for benchmarks; useful for filtering |
| OCR part-number misreads | Open — prompt/QA track |
| OCR field bleed between rows | Open — prompt/QA track |
| Validation vs internal extracted dataset | Not started |
