# The learner model

How GapFinder decides what a student knows and what to do about it.

This document describes code that exists. Every number quoted below is produced
by a function named here, and every claim can be checked by running
`npm run eval:deterministic`.

---

## The rule this layer obeys

> **AI interprets. Deterministic code decides.**

A model reads handwriting, phrases explanations and names things in the
student's own language. It is never asked what a student's mastery is, which
misconception applies, or what should happen next. Those are computed, because
a number a model produces cannot be reproduced, cannot be tested, and cannot be
explained to the student it is about.

| Question | Answered by |
| --- | --- |
| What does this handwriting say? | Model |
| Does this step follow from the one above it? | `verify-step.ts` (deterministic) |
| Which step was the first to diverge? | `solution-audit.ts` (deterministic) |
| Which misconception is this? | `detect-misconception.ts` — proved from the numbers where a signature exists; model-matched from a closed catalogue otherwise |
| How strong is this evidence? | `learner/evidence.ts` (deterministic) |
| What is this student's mastery? | `update-mastery.ts` (deterministic) |
| What should happen next? | `learner/intervention.ts` + `learner/next-best-action.ts` (deterministic) |
| How should that be worded? | Model |

---

## 1. Evidence — `src/lib/learner/evidence.ts`

The layer everything else is computed from. Its job is to keep one distinction
that the rest of the system depends on:

> **An answer result is not reasoning evidence.**

A student who reaches the right answer through a broken step has produced a
positive answer result and a negative reasoning result *at the same time*.
Collapsing those into one boolean is what makes a tutoring system confidently
wrong, so `evidenceFromAttempt()` emits them as separate observations and they
stay separate all the way to the mastery score.

Where reasoning was not checked, **no reasoning verdict is emitted at all** — an
unverified step is not a wrong step.

### Weighting

Each observation's weight is `kind × independence × difficulty`:

| Kind | Weight | Why |
| --- | --- | --- |
| `answer_result` | 0.6 | The weakest evidence here. Reachable by luck or copying. |
| `reasoning_quality` | 1.0 | What we actually claim to measure. |
| `recurrence` | 1.2 | The same named slip again is a rule being applied, not carelessness. |
| `remediation` | 0.9 | Outcome after an intervention. |
| `transfer` | 1.5 | The hardest thing to fake. |
| `articulation` | 0.8 | Explaining it back. |

| Independence | Scale | | Difficulty | Scale |
| --- | --- | --- | --- | --- |
| `independent` | 1.0 | | `warmup` | 0.5 |
| `assisted` | 0.6 | | `repair` | 0.8 |
| `guided` | 0.3 | | `challenge` | 1.0 |
| | | | `transfer` | 1.3 |
| | | | `mastery` | 1.5 |

**Independence and difficulty scale positive evidence only.** Failing a warmup
problem with heavy hints is not *weak* evidence of a problem — if anything it is
strong evidence. Discounting it would make the model slowest to react exactly
when a student is struggling most.

Independence is derived from rows, never asked: `deriveIndependence()` reads the
attempt index (a row count) and hints used where the caller knows it. A first
attempt is independent; a third is guided.

### Aggregation

`summariseEvidence()` recency-weights everything with a **21-day half-life** and
returns:

- `positiveShare` — the single number the mastery engine consumes
- `hasIndependentTransfer` — gates the mastery ceiling (below)
- `onlySucceedsWithHelp` — true when they have succeeded but never unaided
- `answerReasoningGap` — how far right answers and sound reasoning disagree
- `confidence` — saturates at a total weight of 8; three observations is not a
  judgement, twelve is

---

## 2. Mastery — `src/lib/ai/pipeline/update-mastery.ts`

```
target   = current + delta(event), scaled by independence and difficulty
newScore = round( current × 0.65 + target × 0.35 )
then     capped at 89 if the concept has never been transferred independently
```

Event deltas: `gap_found −8`, `practice_correct +6`, `practice_incorrect −4`,
`transfer_correct +12`, `transfer_incorrect −3`. Teach-back targets the rubric
score directly (clamped to 0–100 — the rubric can come from a model and is not
trusted blindly).

Every term is a constant in that one file. Given a starting score and an event
log the final number can be recomputed by hand, which is the only reason we are
willing to show it to a student.

### The transfer ceiling

`NO_TRANSFER_CEILING = 89`. Mastery cannot enter the mastered band until the
concept has survived a problem that does not look the same.

Without it, a student who drills one shape twenty times reaches 100 and is told
they have mastered something they have never had to transfer. `computeMasteryUpdate`
returns `cappedPendingTransfer` so a stalled score can be explained rather than
appearing stuck.

The ceiling applies **only when the caller supplies `hasIndependentTransfer`**,
so callers that predate it keep their original behaviour.

---

## 3. Misconceptions — `src/lib/diagnosis/`

Diagnoses resolve to stable codes from a closed catalogue
(`misconceptions.ts`), which is what makes them countable across students and
across weeks. Most are **proved** rather than guessed: a signature is a fact
about the numbers, not a judgement.

Signatures are evaluated in precedence order, most specific first:

1. **`M-FRACTION-ADD-DENOMINATORS`** — the result is exactly `(a+c)/(b+d)`.
   Checked *before* the domain dispatch, because a fraction sum can be routed to
   the quantitative verifier, whose branch would return a generic arithmetic slip
   and never reach the algebra signatures.
2. **`M-TRANSPOSE-SIGN`** — the constant differs by exactly `2b`, which is what
   carrying a term across unchanged does and nothing else produces.
3. **`M-ONE-SIDED-OPERATION`** — the coefficient changed while the constant did not.
4. **`M-DISTRIBUTE-*`** — a bracket in the previous line whose expansion does not match.
5. **`M-ARITHMETIC-SLIP`** — the step has the right shape and the wrong value.

Where no signature fires, the code is left to the model — still constrained to
the catalogue — and recorded with `basis: "matched"` rather than `"proved"`, so
the two are never confused downstream.

### Recurrence — `services/misconception-history.ts`

Recency-weighted with a 14-day half-life. A code seen at least twice becomes a
*prediction*: GapFinder states which mistake it expects before the student
starts, then checks. A prediction that **fails** is the strongest evidence this
product can produce that something changed — and it is only meaningful because
it was stated in advance.

---

## 4. Intervention — `src/lib/learner/intervention.ts`

`selectDifficulty()` decides how hard the next task is. `selectIntervention()`
decides **what kind of thing should happen at all** — a different question, and
the one that makes this adaptive rather than reactive. A tutor who responds to
every error by explaining is not adapting; they are reciting.

Rules are evaluated in order. The ordering *is* the design:

| # | Rule | Action | Why it sits here |
| --- | --- | --- | --- |
| 1 | `prerequisite_not_met` | `prerequisite_review` | Teaching on top of a hole cannot land. Outranks everything. |
| 2 | `persistent_misconception` (≥3) | `prerequisite_review` | Explaining has already failed twice. Change strategy, not volume. |
| 3 | `recurring_misconception` (=2) | `worked_example` | Describing it again is what did not work. |
| 4 | `mastery_candidate` | `mastery_check` | High mastery **and** an unaided transfer. |
| 5 | `needs_transfer_evidence` | `transfer_problem` | Repeating a pattern is not mastery. |
| 6 | `assisted_success_only` | `targeted_practice` | What is missing is independence, not explanation. |
| 7 | `consolidating` | `targeted_practice` | Correct and unaided; reps will settle it. |
| 8 | `arithmetic_slip` | `targeted_hint` | Method right, number wrong. A lesson here would be insulting. |
| 9 | `repeated_failure` | `easier_diagnostic` | This level teaches us nothing. Find the floor. |
| 10 | `explanation_already_tried` | `worked_example` | We already talked through it. |
| 11 | `first_conceptual_error` | `concise_explanation` | Explaining is right exactly once. |

Every decision carries a stable `rule` identifier (asserted in tests, shown in
observability), a student-facing `reason`, the `evidence` it fired on, and a
`confidence` that tracks **how much evidence exists** — not how sure a model
sounds.

---

## 5. Next best action — `src/lib/learner/next-best-action.ts`

A pure function of a learner snapshot. The caller assembles rows; this decides.
That split means a decision can be replayed exactly from a stored snapshot.

**Concept priority:** an open gap (+1000) outranks everything, because
unrepaired misunderstanding compounds — every later concept built on it inherits
the fault. Within open gaps, recurrence (+100 each) breaks the tie. Lower
mastery is more urgent; a concept already mastered is pushed down (−500). Locked
concepts are never recommended.

**Prerequisite retargeting:** when the decision is `prerequisite_review`, the
recommendation is retargeted to the *prerequisite*, not the concept that
surfaced it. That is what makes it actionable rather than merely correct.

**An unassessed prerequisite is not a hole.** A new student has zero mastery
everywhere; reading that as a gap would send every newcomer backwards on their
first submission. Only prerequisites with actual evidence are considered.

Exposed at `GET /api/next-action`, which calls no model — fast, free, and
identical for identical data.

---

## 6. What is measured

`npm run eval:deterministic` scores four dimensions against fixtures whose
expectations are written down independently of the implementation:

| Metric | Cases |
| --- | --- |
| First-divergence detection | 13 |
| Derived-correction validity | 6 |
| Misconception classification | 13 |
| Intervention selection | 13 |

**What this is:** a regression harness. It runs in milliseconds, touches no
model or network, and fails loudly when a rule changes.

**What it is not:** a benchmark on unseen data. These are hand-written fixtures,
and a score on them says the system still behaves as specified — not that it
generalises to arbitrary student work. Two handwriting cases are skipped
outright because no image fixture exists for them, and they are reported as
skipped rather than quietly dropped from the denominator.

---

## Known limitations

- **Hints are not yet recorded.** `deriveIndependence()` accepts a `hintsUsed`
  count, but no surface currently supplies one, so independence is derived from
  attempt index alone. A first-attempt success after reading a hint is
  currently scored as fully independent.
- **`interventionHistoryFor()` infers history** from what a gap implies
  (explained when diagnosed, practised when attempts exist) rather than from a
  dedicated table. It is directionally right and not exact.
- **Misconception signatures are strongest in linear algebra.** Chemistry and
  physics have fewer, and biology has none — those fall through to
  model-matching against the catalogue.
- The eval set is small. 100% on 13 fixtures is a statement about regression,
  not about accuracy in the wild.
