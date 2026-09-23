# Matcher evaluation — gold-standard workflow

The fuzzy matcher decides which quotes merge into one benchmark. A **false merge**
(two different parts merged) produces a wrong median that an insurer might use in a
dispute — the dangerous error. A **false split** just thins the median — the safe
error. This harness measures both, against the *exact* code the app runs
(`src/pipeline.js` is imported directly, so eval results always reflect the live matcher).

## Workflow

```
node eval/generate_pairs.mjs https://mm-parts-index.vercel.app/api/parts   # 1. sample pairs from the live reference
# 2. an adjuster fills the `label` column: y / n / ?   (guide below)
npm run eval:score                  # 3. precision / recall / F1 across thresholds
npm run eval:score -- --human-only  #    the same, without the "y (auto)" rows
npm run eval:provisional            #    until the adjuster has labelled: score Claude's first pass
```

`eval:provisional` fills every empty `label` from `claude_label`, prints a
PROVISIONAL banner, and writes `results.provisional.csv` — never `results.csv`.
`eval:score` refuses to run when every labelled row is `y` (only the auto rows),
since precision is meaningless without negatives.

The generator also takes a local JSON file (an array of rows, or the
`{ parts: [...] }` that `GET /api/parts` returns), or no argument for the demo set.

**How the sample is drawn.** Lines are prepared exactly as the app loads them and
filtered to what the benchmark uses. Repeat quotes of the same part collapse to
one line. Pairs the app's guards could never merge (different grade, unit basis
or make, or a positional veto) are skipped. The rest are sampled per similarity
band — dense around the 0.65 threshold, 35 pairs of identical-name /
different-number lines (the likeliest false merges in fuzzy-name mode), sparse at
the low end — with no line in more than three pairs. The sample is seeded, so the
same data gives the same file.

**Weights.** Each row carries a `weight`: candidates in its band ÷ pairs sampled
from it. The sample over-represents the threshold region on purpose, and
`eval:score` weights by this column so the figures describe the reference, not the
sample. The low band carries very large weights (≈9,000 per pair), so a single `y`
there moves recall a lot; that is correct, but check those rows twice.

**The current file** (23 September 2026, 1,536 live lines): 203 pairs to label,
22 pre-labelled `y (auto)`. It also carries a first pass by Claude in
`claude_label` / `claude_conf` (h/m/l) / `claude_note`, sorted least-confident
first. The `label` column is still empty and is the only one `eval:score` reads.
The adjuster fills it by agreeing with or overriding each first-pass call. Claude's
labels are **not** a gold set: score them only through `eval:provisional`, and do
not cite the result or pin a threshold from it.

**Provisional reading (Claude's labels, 23 September 2026):** at the shipped 0.65,
≈27% of name-based merges are the same part (population-weighted); no threshold
reaches 95% precision; and of 35 identical-name pairs, 24 were labelled different
parts — mostly the same part name on different vehicles. If the adjuster confirms
the "different vehicle = different part" policy, the fix is the matching mode
(hybrid / part-number-first, or same-model), not the threshold.

## Labeling guide — for the adjuster

Each row is two supplier-bill lines from the same make. The one question:
**if an estimate quoted part A, would you accept part B's price as evidence of what
A should cost?** Write `y`, `n` or `?` in the `label` column. Nothing else in the
file needs editing.

- Read `part_name_a` / `part_name_b` and the part numbers first; `model_*`,
  `unit_*` (price), `supplier_*` and `bill_*` are context. Ignore `band`,
  `similarity` and `weight` — hide those columns if they are distracting; they are
  what is being tested.
- `y` — the same part for pricing: same component, same position, the model may
  differ only where the part is shared. LH vs RH mirror parts are `y` (policy below).
- `n` — a different part, a different position (front/rear, upper/lower, inner/
  outer), sub-component vs full assembly, or the same name on clearly different
  models where the part differs (e.g. a headlamp for two different vehicles).
- `?` — you cannot tell without the physical part or a catalogue. `?` rows are
  skipped in scoring, so use it rather than guessing.
- Look up a part number if it settles the question quickly; do not spend more than
  a minute on any one row. Expect roughly 1–2 hours for the whole file.
- Rows labelled `y (auto)` at the bottom share a part number; leave them.

## Labeling policy — decide this once, apply it consistently

**"Same part" (y) = interchangeable for pricing purposes.**

- LH/RH mirror-image variants of the same part → **y** (they carry different part
  numbers but virtually always the same price; a benchmark that splits them halves
  its sample for no pricing benefit).
- Sub-component vs full assembly (headlamp *house* vs headlamp *unit*) → **n**.
- Same part word, different position (hood weatherstrip vs hood *front*
  weatherstrip; front door vs rear door) → **n**.
- Different grade (genuine vs aftermarket) → **n** — but note the app now blocks
  these merges independently via the grade field, so label on identity alone.
- Genuinely can't tell from the names/numbers → **?** (skipped in scoring).

If the team prefers the strict definition (LH ≠ RH), relabel accordingly — the
harness doesn't care which policy you pick, only that it's consistent.

## Reading the results

`eval:score` prints precision/recall/F1 for thresholds 0.40–0.95 at token weights
0.4/0.6/0.8, plus two summary rows:

- **Best F1** — use if false merges and false splits hurt equally.
- **Dispute-grade (precision ≥ 95%)** — the highest-recall setting that keeps false
  merges under 5%. For a benchmark used in settlement negotiations, this is the row
  that matters. If no setting reaches it, name-only matching isn't defensible on its
  own: prefer Hybrid mode, or fix the matcher and re-score.

## Findings from the demo set (illustrative labels, 137 pairs)

`gold_pairs.example_labeled.csv` is a worked example — the labels are one
reasonable judgment call, not team-approved ground truth. Re-label before trusting
numbers. Even so, it already surfaced two real issues at the current default
(threshold 0.65, token weight 0.6):

1. **Stopword bug — FIXED in v1.12.0 via a positional veto.** Positional tokens
   stay stripped for similarity (so spelling variants merge), but a signature
   read from the raw name hard-blocks merges that explicitly conflict on an
   axis: front/rear, upper/lower, inner/outer always; LH/RH only when the
   "Separate LH / RH" option is on (default off, per the side-pooling policy
   above). `evaluate.mjs` replays the veto before the threshold, so this
   harness scores the exact merge decision the app makes. Note the veto only
   fires on *symmetric* conflicts — a marked vs an unmarked name (pair 5:
   "WEATHERSTRIP, HOOD, FR" vs "WEATHERSTRIP, HOOD") is deliberately left to
   the threshold, which is why the worked example's metrics did not move.
2. **Threshold headroom — still open.** "BALL JOINT ASSY" vs "BALL JOINT
   ASSY-INR L/R" (marked vs unmarked, so not vetoed) scores 0.69 and
   false-merges at 0.65. On this small set, raising the default toward
   0.70–0.75 costs zero recall. Confirm on the 200-invoice gold set before
   changing the shipped default.
