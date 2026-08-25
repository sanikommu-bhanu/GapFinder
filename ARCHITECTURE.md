# GapFinder — Architecture

## What was verified, and how

Everything below was run against the live app on this machine: `npm install`,
`prisma db push`, `db:seed`, the dev server, a real `GEMINI_API_KEY`, the unit
suite, the deterministic eval, and `next build`. Where something is unverified,
it says so explicitly in **Known limits** at the end.

---

## The design rule

**AI interprets. Deterministic code verifies.**

A language model is the only thing that can read handwriting or infer what a
student was attempting. It is *not* trustworthy for deciding whether a student
made a mistake — it can be confidently wrong, and a false accusation is the
worst failure this product can have. So the load-bearing claims are computed:

| Decision | Owner | Rationale |
| --- | --- | --- |
| What do the marks say? | Gemini vision | Only a model can read it |
| What was the student attempting? | Gemini | Requires reading intent |
| Does step *n* follow from *n−1*? | `mathjs` | Must be provable |
| Where is the first divergence? | `solution-audit.ts` | The core claim |
| What should that step have read? | `solve-step.ts` | Never generated |
| Root error vs. carried consequence? | `solution-audit.ts` | Structural, not stylistic |
| Which concept broke? | Gemini (fallback: structural) | Needs judgement |
| Is practice work correct? | Same divergence engine | Grading must be exact |
| Is a generated problem valid? | Solved independently | Never show an unverified problem |

---

## Pipeline

```
POST /api/analyses                       returns 202 in ~250ms
        │                                (never blocks the UI)
        ▼
  status: reading         Gemini vision reads the lines
                          → low confidence anywhere? pause and ASK the student
  status: reconstructing  Gemini narrates each step
                          → expressions copied through, never rewritten
  status: verifying       mathjs verifies every transition; audit runs
                          → first divergence + corrected line computed here
  status: classifying     Gemini names the concept, from verified steps only
  status: explaining      local RAG retrieves; Gemini grounds its wording in it
  status: complete
```

The Analyzing screen polls `/api/analyses/[id]/status`, so the progress bar
tracks stages that actually finished. A run that dies mid-pipeline is detected
by age and reported, rather than spinning forever.

### Reconstruction is reconciled, not trusted

`reconstruct-reasoning.ts` rebuilds its output from the student's own step list
and takes only the *narration* from the model. A model that dropped, merged or
silently corrected a line would corrupt the divergence search that runs next —
invisibly. This is enforced in code, not by prompt instruction.

### Gemini schema conversion

`zod-to-json-schema` emits `additionalProperties`, which Gemini's
`responseSchema` rejects with a 400 — this made *every* structured call in the
project fail. `schemas/to-gemini-schema.ts` reduces a zod schema to the exact
subset Gemini documents, inlining `$ref`s and collapsing `anyOf` (preserving
nullability). Every response is then re-validated against the original zod
schema before it is used.

---

## Complete Solution Audit

Each step is judged against two references — the student's own previous line,
and the correct path:

| Verdict | Meaning |
| --- | --- |
| `correct` | Follows, and still solves to the right answer |
| `first_divergence` | First line that does not follow |
| `downstream_consequence` | Correctly worked from an already-wrong line |
| `independent_error` | A separate mistake, not inherited |
| `uncertain` | Could not be evaluated — never counted as an error |

A submission where *every* step is `uncertain` fails with an honest message
rather than reporting "everything checked out". Claiming a verification that
never happened is the one outcome the audit must not produce.

---

## RAG

Local TF-IDF over a curated corpus of `KnowledgeChunk` rows (explanations,
misconceptions, worked examples, teaching strategies) — no paid vector
database, and no embedding cost. Two retrieval modes:

- **Per concept** — for gap explanations, filtered by chunk kind
- **Across concepts** — for the coach, boosting concepts the student has open
  gaps in, because a general question still deserves an answer about their work

Retrieved chunk IDs are stored on the `AiUsageLog` row for the call, and
surfaced in the UI: "Grounded in *n* sources", expandable to read them. If
retrieval returns nothing, the component renders nothing rather than implying
a grounding that did not happen.

---

## Adaptive learning

`selectDifficulty` picks the level deterministically from mastery and recent
attempts, *before* generation — so the model is told what to build rather than
also deciding how hard it should be.

`computeMasteryUpdate` is an EMA where **transfer success is weighted roughly
double practice success**. Passing a repair problem can be pattern-matching;
passing the same idea in a shape you haven't seen cannot. Teach-back moves the
score toward the rubric result.

Gap lifecycle: `open` → `repaired` (practice passed) → `closed` (transfer passed).

---

## Graceful degradation

Observed live, after the free-tier quota was genuinely exhausted during
testing. With all three Gemini calls failing:

- First divergence still found correctly (sign error, step 2)
- Concept still classified — `sign-error` / Sign Handling — at **medium**
  confidence rather than the high Gemini reports, because structural evidence
  is genuinely weaker
- Corrected expression and full corrected solution still derived
- Explanation still grounded in 2 real retrieved chunks
- Practice still generated and validated, labelled `Verified locally`
- Completed in ~2s

Every surface labels provenance (`AI · verified` vs `Verified locally`). The
app degrades; it does not lie about what produced a result.

---

## Security

- `src/middleware.ts` — **must** live under `src/`; with a src directory Next.js
  ignores a root-level middleware file entirely, which had left every protected
  route publicly reachable. Verifies the JWT signature via `jose` (edge-safe),
  and clears a cookie that fails verification.
- Every API route independently calls `getSessionUserId()` and scopes queries by
  user. Cross-user access was tested with a second account: 404 on analyses,
  gaps, and practice.
- Login hashes against a dummy value when the account doesn't exist, so response
  timing doesn't reveal which emails are registered.
- All inputs bounded by zod (image size, step count, text length, enum values).
- `GEMINI_API_KEY` is read only in server modules; `src/lib/env.ts` is never
  imported from a client component.

---

## Performance

| Measurement | Result |
| --- | --- |
| `POST /api/analyses` (warm) | ~250 ms — the UI is never blocked |
| Full pipeline, 3 live Gemini calls | ~12 s |
| Full pipeline, cache hit | ~2 s |
| Full pipeline, all Gemini down | ~2 s (deterministic) |
| First Load JS (shared) | 87.3 kB |
| Largest route | ~111 kB |

Gemini responses are cached by content hash (`AiCallCache`); images are
compressed with `sharp` before upload; the concept graph loads concurrently
with verification writes; gap creation, the learning event and the status
update are one transaction.

---

## Testing

```
npm run verify   # lint + typecheck + 88 unit tests + deterministic eval
```

- **88 unit tests** across the verifier, the audit, derived corrections,
  student-work checking, problem validation, difficulty selection, mastery
  scoring, the offline rubric and visual selection.
- **Deterministic eval** over 15 fixtures — correct work, single root error,
  root + downstream, multiple independent errors, fractions, negatives,
  distribution, word problems, alternative valid approaches. **13 passed, 0
  failed, 2 skipped** (need image fixtures). **100% divergence-detection
  accuracy on scored cases.**

---

## Known limits

These are real and unfixed:

- **Only single-variable linear algebra is genuinely verified.** That covers
  linear equations, distribution and rearrangement completely, and the symbolic
  half of physics/chemistry working. It does **not** check units, balance
  chemical equations, or read diagrams. The capture screen states this per
  subject rather than implying full support.
- **Gemini-stage accuracy is unmeasured.** The deterministic layers are
  measured at 100% on the fixture set; extraction and classification accuracy
  have no automated harness and no numbers.
- **No image fixtures**, so the handwriting-reading stage is verified only by
  live manual use, not by the eval suite.
- **No automated E2E suite.** The critical path was walked manually in a real
  browser and via the API; there is no Playwright/Cypress run guarding it.
- **SQLite and local-disk uploads** are fine for a single instance and will not
  survive a serverless deployment without swapping the datasource and moving
  uploads to object storage. The Prisma schema is portable; the upload path is
  not.
