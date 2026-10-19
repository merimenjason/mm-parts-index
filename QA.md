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

### Update, October 2026 — second reading of a sample

A sample of **45 bills** (474 lines) was read a second time by Claude Opus 5.5
(effort medium, US$1.74) and compared line by line with the reference: 30 bills
chosen at random and 15 targeted at known suspect lines. Five of them (34
lines) are set aside for a person to check blind. Files and scripts:
[`validation/2026-10/`](validation/2026-10/README.md).

| | |
| --- | --- |
| Lines where both readings agree (random bills) | **209 / 216 (96.8%)** |
| Lines where both readings agree (all bills) | 453 / 474 |
| Price differences | **0** |
| Part-number differences | 13 (7 on random bills) |
| Bill-number differences | 2 (`LL10325981` vs `LI10325981`; `EPC-5199563-1` vs `5199563`) |
| Lines the second reading could not find on the bill | 8, all on B32, a cropped screenshot |
| Lines the second reading thinks were missed | 1 (B11; it says the line is a separate invoice on page 2) |

Every part-number difference that could be checked was then looked up in the
maker's parts catalogue (Amayama for Kia, Mercedes-Benz, Honda and Toyota; web
search for Tesla and Mazda). A real number exists and matches the item; a
misread usually does not. Of 15 checkable rows: **second reading right 9**,
first reading right 1, both wrong 1, can't tell 4. New misread types:

```
1771986-SC-C           both readings; real part is 1771936-SC-C  ← 9 / 3 again
1 A205 620 34 01       quantity column read into the part number
A253 880 02 28         RH hinge number on a line that says "HINGE BONNET LH"
1044341-00-E           lateral-link number on a "TIE ROD OUTER" line (should be 1044841)
```

**Provisional reading:** about **3 wrong part numbers per 100 lines and no
price errors.** Not final — a person still has to confirm the 25 flagged rows
and do the 34-line blind check. A wrong part number does not change a price,
but it can stop a line joining its benchmark (or join the wrong one).

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

### Update, October 2026 — part-number lookups

The weakness above was searching by part *name*. Looking up each **part
number** in a genuine-parts catalogue works much better: it says exactly what
the part is and which vehicles it fits. 106 lines from 16 benchmarks were
checked (the widest price ranges, the headlamp example from the call, and 5
tight-range controls) — **86 distinct part numbers**. Toyota and Mercedes-Benz
went through Amayama (**74 of 75 found**); Tesla and Audi through web search.

| Suggested reason for the line's price | Lines |
| --- | --- |
| Same part, price just varies | 47 |
| Same part name, **different car** | **42** |
| Smaller piece of the part (bracket, clip, cover) | 10 |
| Different position (front/rear, upper/lower) | 6 |
| Reading mistake | 1 |

- **The ranges are mostly real, but mostly not one part.** The S$85–3,600
  headlamp range from the call is **10 different vehicles**; the S$3,600 lamp is
  a Lexus RX. This backs the §10 finding: the fix is matching (part number
  first, or same model), not the statistics.
- Bill prices sit at a median **1.19×** the online genuine-part price (Amayama
  ships from Japan and excludes shipping and GST), so the levels are plausible.
- Errors found: `MBA003 990 94 97` (the "COVER BUMPER" line in §7) is confirmed
  a blind rivet; Tesla `1771986` is a misread of `1771936`; **Lexus parts are
  recorded with make Toyota**, so they can join Toyota benchmarks.

Still provisional: a reviewer has to confirm the suggested reason on each of
the 106 lines. Workbook, lookups and scripts:
[`validation/2026-10/`](validation/2026-10/README.md).

### Which average to use

Asked during the review: should the benchmark be the mean, median, trimmed
mean or something else? Each was tested by leaving one quote out and measuring
how far it lands from the benchmark built from the rest of its group (77
groups with 3+ quotes, 367 quotes; percentage gaps, so cheap and dear parts
count equally):

| Method | Typical gap | Within ±25% |
| --- | --- | --- |
| **Median** | **22%** | **55%** |
| Hodges–Lehmann | 25% | 52% |
| Trimmed mean (20%) | 26% | 49% |
| Geometric mean | 27% | 48% |
| Mean | 29% | 49% |

**Keep the median.** With 4–9 quotes per group a 20% trim drops 0–1 quotes per
end, so it barely differs from the mean. Splitting the same test by matching
shows what really matters: where every quote shares one part number the gap is
**0%** for every method; where quotes were grouped by name only it is 25–33%.
Better matching, a recency window (bills go back to 2016) and showing the
Q1–Q3 band beside the median will help more than another statistic.
Reproduce with `node validation/2026-10/bench_compare.mjs`; the write-up for
stakeholders is `validation/2026-10/Benchmark_statistic_recommendation_2026-10-16.docx`.

---

## 10. What this exercise did *not* measure

Everything above measures how **wide** clusters are. None of it measures
whether a cluster is **right** — whether the lines inside it are actually the
same part. That is a separate question and it is currently unanswered.

The harness for it already exists (`eval/generate_pairs.mjs`,
`eval/evaluate.mjs`, `npm run eval:score`) and replays the production
`similarity()` and `posConflict()` over candidate pairs. What is missing is the
labelled input:

| | |
| --- | --- |
| Pairs in `eval/gold_pairs.csv` | 138 |
| **Pairs with a label** | **0** |

*(Status as of this report, 17 September. Step 1 below has since been done and
a provisional first pass exists — see "Update, 23 September" at the end of this
section.)*

**Do not cite `eval/results.csv`.** Its best row reads precision 0.89 /
recall 1.00 / F1 0.94, but it was produced from
`gold_pairs.example_labeled.csv` — a *demonstration* labelling with 8 positives
— and is not evidence about this dataset. The shipped `threshold: 0.65` is
therefore an uncalibrated guess.

Two things would fix it, in order:

1. **Regenerate the sample from the live reference.** The current 138 pairs come
   from `DEMO_18`, not the 1,536 live lines, and should be stratified across the
   similarity range — dense near 0.65 where the decisions are genuinely hard,
   sparse at 0.95+ and 0.4− where they are obvious. Labelling 138 easy pairs
   teaches nothing.
2. **Label them `y` / `n`** — does this pair belong in one benchmark? This needs
   a claims adjuster's judgement, not a script. The first two rows of the
   current file are a fair illustration of why:

   ```
   DISTANCE SENSOR  MBA000 905 55 04  vs  DISTANCE SENSOR  MBA000 905 56 04
   HEADLAMP UNIT    MBA213 906 67 01  vs  HEADLAMP UNIT    MBA213 906 68 01
   ```

   Identical names, adjacent part numbers, identical prices — and both are
   near-certainly LH/RH siblings. Section 5 argues merging those is *safe*
   (4.1% median difference); the labelled set is what would confirm it.

The output is the number the review call actually asked for: **at threshold
0.65, what fraction of merges are wrong?** Until it exists, every figure in
this document describes the spread of clusters whose correctness is assumed.

### Update, 23 September 2026

- **Step 1 is done.** `eval/gold_pairs.csv` was regenerated from the 1,536 live
  lines: **203 pairs** sampled by similarity band (dense near 0.65), pairs the
  app's grade / basis / positional guards never merge left out, plus **22
  `y (auto)`** pairs that share a part number. Each row carries a band weight so
  scores describe the reference, not the sample (method in `eval/README.md`).
- **Step 2 is not.** The `label` column is still empty. Claude has done a
  first pass in separate `claude_label` / `claude_conf` / `claude_note` columns
  for an adjuster to confirm or override.
- **Provisional reading, from Claude's labels only** (`npm run
  eval:provisional`; not adjuster-verified, not for citing): at 0.65, **≈27%**
  of name-based merges join the same part; **no threshold reaches 95%
  precision**; and of 35 identical-name pairs, 24 were labelled different parts
  — mostly the same part name on different vehicles. If an adjuster confirms the
  "different vehicle = different part" policy, the answer is the matching mode
  (part-number first, or same model), not the threshold.
- **Side findings from the labelling:** the positional veto misses dotted
  abbreviations (`RR.` / `F.`); six same-part pairs were split by supplier
  prefixes or model text in the part-number field (`T` vs `ZZT`, `MI` vs `J`,
  `MBA` vs `X`, `81130-0L011 KDH200`); one Tesla line carries make "Land Rover";
  and a "bill … already extracted" artefact sits in the reference as a part line.
- **v1.18.0 acts on it provisionally:** an opt-in *Flag name-matched benchmarks*
  setting marks any benchmark whose quotes do not all share one part number as
  unverified (median shown, no statistical bound). On the live reference it
  flags **42 of the 45** benchmarks with 4+ quotes.

---

## 11. Open items

| Item | Status |
| --- | --- |
| `parseDate` slash-ISO | **Fixed** (v1.17.2) |
| Supplier-independence reliability floor | Recommended, not implemented |
| `*_SUPPORT` component rule | Recommended, not implemented |
| Pair-vs-single detection | **Open — no signal in the data** |
| Model capture | Low priority for benchmarks; useful for filtering |
| OCR part-number misreads | Open — prompt/QA track; ≈3 per 100 lines, 0 price errors (§7 update, provisional) |
| OCR field bleed between rows | Open — prompt/QA track |
| OCR sample review by a person (25 flagged rows + 34-line blind check) | **Pending** (§7 update) |
| Price-range review by a person (106 lines, suggested reasons filled in) | **Pending** (§9 update) |
| Lexus parts recorded with make Toyota | Open — found in part-number lookups (§9 update) |
| Validation vs internal extracted dataset | Not started |
| **Matcher precision/recall** | **Open — live gold set regenerated 23 Sep (203 pairs); Claude first pass done, adjuster labels 0/203 (§10)** |
| Threshold 0.65 calibration | Open — blocked on the above; provisionally, no threshold reaches 95% precision |
| Name-matched benchmarks flagged as unverified | **Added v1.18.0 — provisional, off by default** |
| Positional veto misses `RR.` / `F.` abbreviations | Open — found in labelling (§10 update) |
| Part-number prefixes / model text split same-part lines | Open — found in labelling; fix parked as too complex for now |
| 14 stray "Run Log" rows in the live reference | Open — now needs an operator-side delete |
