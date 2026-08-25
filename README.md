# GapFinder

**Don't just find the wrong answer. Find where understanding broke.**

A student gets a problem wrong. Every tool they have tells them *that* it's
wrong, and most will show them the right answer. Neither tells them the thing
that actually matters: **which step their reasoning stopped being sound, and
what they misunderstood to make that step.**

GapFinder reads handwritten working, reconstructs the reasoning behind it,
finds the first line that doesn't follow, names the concept underneath it,
teaches that concept, and then verifies the student learned it by giving them
the same idea in a shape they haven't seen.

---

## The moment it exists for

Given this worked solution:

```
2(3x-5) - 4(x+2) = 3(x-1) + 7
6x - 10 - 4x + 8 = 3x - 1 + 7
2x - 2 = 3x + 6
2x - 3x = 6 + 2
-x = 8
x = -8
```

The student's own note on this page says *"the mistake is in combining like
terms in the 3rd step."* It isn't. GapFinder reports:

```
  OK   1. 2(3x-5) - 4(x+2) = 3(x-1) + 7
>>>>   2. 6x - 10 - 4x + 8 = 3x - 1 + 7     FIRST DIVERGENCE
            should be: 2x - 18 = 3x + 4
   ~   3. 2x - 2 = 3x + 6                    carried from above
   ~   4. 2x - 3x = 6 + 2                    carried from above
   ~   5. -x = 8                             carried from above
   ~   6. x = -8                             carried from above
```

One mistake, not five. The divergence is in the *distribution* — one line
earlier than the student thought — and everything after it was worked
correctly from a line that was already wrong. That distinction is the product.

---

## What makes the diagnosis trustworthy

The rule throughout: **AI interprets, deterministic code verifies.**

| Decision | Made by | Why |
| --- | --- | --- |
| What does the handwriting say? | Gemini (multimodal) | Only a model can read it |
| What was the student trying to do? | Gemini | Requires reading intent |
| Does this step actually follow? | `mathjs` algebra | A model can be confidently wrong |
| Where is the first divergence? | Deterministic audit | The core claim must be provable |
| What should the step have been? | Derived algebraically | Never generated |
| Which concept broke? | Gemini, from verified steps | Needs judgement |
| Is the practice answer right? | Deterministic, step by step | Grading must be exact |
| Is a generated problem valid? | Solved independently | Never show an unverified problem |

A language model never decides whether a student made a mistake, and never
supplies the corrected line they're asked to trust. Those come from algebra.

## Complete Solution Audit

Every step is classified against two references at once — the student's own
previous line, and the correct path:

- **`correct`** — follows, and still solves to the right answer
- **`first_divergence`** — the first line that doesn't follow
- **`downstream_consequence`** — correctly worked from a line already carrying the error
- **`independent_error`** — a separate mistake, not inherited from the first
- **`uncertain`** — could not be evaluated (never counted as an error)

The distinction between a root misconception and the errors it causes is what
turns "you got four steps wrong" into "you made one mistake, here."

## Architecture

```
Photo or typed working
        │
        ├─ Gemini vision ──── read the lines
        │                     (asks rather than guesses when unsure)
        ├─ Gemini ─────────── reconstruct the student's reasoning
        │                     (expressions are copied through, never rewritten)
        ├─ mathjs ─────────── verify every transition, run the audit
        │                     ← the first divergence is computed here
        ├─ Gemini ─────────── classify the concept that broke
        ├─ local RAG ──────── retrieve curated teaching knowledge
        └─ Gemini ─────────── explain, grounded in what was retrieved

                      ↓ persisted at every stage

  practice → transfer → teach-back → mastery → memory → next best step
```

Analysis runs asynchronously: the request returns immediately and the
Analyzing screen polls the real pipeline stage, so progress reflects work
finishing rather than a timer.

### When Gemini is unavailable

Rate limits and outages happen mid-demo. Every model-dependent stage has a
deterministic fallback that runs on the same verified algebra, and every
surface labels which one produced what it's showing (`AI · verified` or
`Verified locally`). The app degrades; it does not break, and it never
pretends a local result came from the model.

## Running it

```bash
npm install
cp .env.example .env          # add your GEMINI_API_KEY
npm run db:push               # create the SQLite database
npm run db:seed               # concept graph + RAG knowledge base
npm run dev
```

The seed creates **no users and no student data** — only the curated teaching
content the product reasons over. Every analysis, gap, mastery score and
report in the app is produced by real student actions running the real
pipeline.

Without a `GEMINI_API_KEY` the deterministic layers still run; the stages that
genuinely need a model will say so.

## Verifying it

```bash
npm run verify   # lint + typecheck + unit tests + deterministic eval
```

- **88 unit tests** over the verification layer, the audit, the derived
  corrections, problem validation, mastery scoring and visual selection
- **Deterministic eval** across 15 reasoning fixtures — correct work, root
  errors, root + downstream, multiple independent errors, fractions, negatives,
  distribution, word problems, alternative valid approaches

```
13 passed · 0 failed · 2 skipped (need image fixtures)
Divergence-detection accuracy on scored cases: 100%
```

## Stack

Next.js 14 (App Router) · TypeScript · Prisma + SQLite · Tailwind ·
Google Gemini · mathjs · zod · vitest

Free tier throughout: no paid vector database, no paid OCR, no second model
provider. Retrieval is local TF-IDF over a curated corpus; every Gemini
response is schema-validated and cached by content hash.
