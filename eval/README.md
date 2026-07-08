# Matcher evaluation — gold-standard workflow

The fuzzy matcher decides which quotes merge into one benchmark. A **false merge**
(two different parts merged) produces a wrong median that an insurer might use in a
dispute — the dangerous error. A **false split** just thins the median — the safe
error. This harness measures both, against the *exact* code the app runs
(`src/pipeline.js` is imported directly, so eval results always reflect the live matcher).

## Workflow

```
npm run eval:pairs          # 1. generate eval/gold_pairs.csv (candidate pairs)
# 2. open gold_pairs.csv, fill the `label` column: y / n / ?
npm run eval:score          # 3. precision / recall / F1 across thresholds
```

To evaluate against the incoming 200-invoice data instead of the demo set, export
the raw rows to JSON and pass the path: `node eval/generate_pairs.mjs data/parts.json`.

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
