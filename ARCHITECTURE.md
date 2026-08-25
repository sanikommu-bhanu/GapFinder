# GapFinder — AI Architecture Report

## Status honesty note
This sandbox has no network access, so I could not run `npm install`, `prisma generate`,
a dev server, or a live Gemini call here — meaning nothing below was freshly tested in
this session. The codebase already implements most of the spec (see "What's real" vs
"What's missing" below). Everything in this report describes what's actually in the repo,
not aspirational scope.

## Models / providers
- **Vision + reasoning**: Google Gemini (`GEMINI_MODEL`, default `gemini-2.0-flash`) via
  `src/lib/ai/gemini-client.ts`. All 17 pipeline stages call structured-output prompts
  (Zod schemas in `src/lib/ai/schemas/pipeline.ts`) and validate the JSON before it
  touches the database — invalid shapes throw and the pipeline fails gracefully rather
  than persisting hallucinated structure.
- No vector DB / paid retrieval service. RAG is local TF-IDF over a curated
  `KnowledgeChunk` table (see below) — deliberate, since the knowledge base is small
  and curated, not a general corpus.

## Data flow (upload → recommendation)
1. `read-and-extract.ts` — vision call reads handwriting into `ExtractedStep[]` with
   per-step confidence. Low confidence → `needs_confirmation`, pipeline pauses and asks
   the student rather than guessing (`ARCHITECTURE` enforces the "don't hallucinate"
   rule from the spec).
2. `reconstruct-reasoning.ts` — normalizes steps into `ReasoningStep[]` with parsed
   expressions.
3. `verify-and-find-divergence.ts` — deterministic math verification
   (`src/lib/verification/math-verifier.ts`, uses `mathjs`) marks each step valid/invalid
   and flags the **first** invalid step as `isFirstGap`; downstream wrong steps are
   recorded but not treated as independent misconceptions.
4. `classify-gap.ts` — maps the divergence to a `Concept` (surface error, underlying
   gap, evidence, confidence) against the seeded concept graph.
5. `retrieve.ts` (RAG) + `explain-gap.ts` — pulls the top-k `KnowledgeChunk`s for that
   concept (definitions, misconceptions, worked examples, teaching explanations) and
   grounds the generated explanation in them + the specific evidence from step 3.
6. Everything is persisted (`ExtractedStep`, `ReasoningStep`, `Gap`, `LearningEvent`)
   so nothing shown to the student is regenerated from memory later — reports and the
   coach read from these rows, not from a fresh model call re-imagining the session.

## Practice → transfer → teach-back
- `generate-practice.ts` produces a problem targeting the diagnosed misconception, then
  `validate-answer.ts` deterministically re-solves it before it's ever shown (rejects
  ambiguous/impossible/mis-keyed problems rather than trusting the generator).
- Transfer problems reuse the same concept in a different surface form (per spec) and
  go through the same validation gate.
- `evaluate-teachback.ts` grades the student's own explanation against a rubric
  (concept, reasoning, correct rule, correct application) rather than keyword matching.

## Mastery model
`update-mastery.ts` + `mastery-service.ts`: mastery is a bounded running score updated
per event type (gap found, practice correct/incorrect, transfer correct/incorrect,
teach-back score) with a trend (`up`/`down`/`flat`), not a flat "+1 per correct answer."
History is kept (last 30 points) so the mastery UI can show real trend, not just a
current percentage.

## Knowledge graph
`Concept` + `ConceptRelationship` (`prerequisite` / `related` / `extends`) tables are
real relational data, seeded in `prisma/seed.ts`, and are what `generate-recommendation.ts`
walks to produce the "Next Best Step" (concept + why + evidence + activity).

## Learning memory
`LearningMemory` aggregates recurring gaps, successful/failed repairs, and transfer
results per user — this is what the AI Coach (`api/coach/route.ts`) is grounded in, so
"why do I keep making this mistake" is answered from real recurrence counts, not a
generic LLM guess.

## Visual Lesson Engine (added this session)
`src/lib/ai/visuals/select-visual.ts` + `src/components/visuals/*` + wired into the
existing "Concept Visual" screen (`analysis/[id]/page.tsx`, `view === "concept"`).

Deliberate design choice vs. the literal spec wording ("AI selects the module and
supplies parameters"): module *and* numeric parameters are chosen **deterministically**
from the already-verified equation string (`src/lib/math/linear-parse.ts`), not by an
LLM call. The spec's own reliability rule — never trust a generator with the critical
numbers in a math diagram — argues against having a model "supply parameters" even in
text form, since a hallucinated coefficient is exactly as wrong as a hallucinated image.
If the concept has no safe deterministic mapping or the equation string doesn't parse,
`selectConceptVisual` returns `{ kind: "none" }` and the screen falls back to the
existing plain-text explanation — safe fallback over a fabricated diagram.

Modules implemented: balance-equation (wired to inverse-operations/equations/algebra,
matches your reference mockup's scale illustration), number-line (sign-handling),
distributive-area (distribution), factor-tree (factoring). Fraction-bar and
coordinate-plane components exist and are ready to wire in but aren't yet mapped to a
seeded concept slug (no "fractions" or graphing concept is seeded in `prisma/seed.ts`
today — flagged below).

## Evaluation harness (added this session)
`eval/fixtures/reasoning-cases.json` — 15 cases spanning correct work, wrong intermediate
step, wrong final answer, multiple errors, negative numbers, distribution (correct and
partial), factoring, fractions, an alternative-valid-approach case, a word problem, and
two behavior-only entries for ambiguous/messy handwriting (those need real image
fixtures I didn't have to attach this session).

`eval/run-deterministic.ts` runs the subset of cases that only exercise
`math-verifier.ts` (pure `mathjs`, no API key, no DB) — run with
`npx tsx eval/run-deterministic.ts` once `npm install` has been run. I hand-traced every
case against the verifier's proportionality logic since I can't execute code in this
sandbox (no network to `npm install`), and adjusted three cases that would have
"passed" for the wrong reason or failed on scope the deterministic verifier was never
meant to cover — each is now labeled honestly in its `note` field rather than silently
fudged. That hand-trace is not a substitute for actually running it; treat the file as
unverified until it's been run for real.

The Gemini-dependent stages (extraction, reconstruction, classification, explanation)
have no automated eval yet — that requires a configured `GEMINI_API_KEY` and a live
run, which this sandbox can't do.

## AI Observability (added this session)
`AiUsageLog` now carries `analysisId`, `latencyMs`, and `retrievedChunkIds` (schema
change — needs `prisma db push`/migrate once this is run for real). `generateStructured`
in `gemini-client.ts` times every call and writes those fields on both the cache-hit and
live-call paths. Threaded through the four core pipeline stages
(`read-and-extract`, `reconstruct-reasoning`, `classify-gap`, `explain-gap`) and the
orchestrator that calls them — `explain-gap` also logs which `KnowledgeChunk` ids the
RAG step actually retrieved, so retrieval is traceable per call, not just per feature.

New screens: `/dev/observability` (list, with per-analysis call count / avg latency /
error count) → `/dev/observability/[id]` (full trace: input → extracted steps →
reasoning replay with first-divergence highlighted → gap + retrieved knowledge +
generated intervention → practice/transfer/teach-back results → raw call log with
latency and errors). Linked from Settings → Developer. New API routes at
`src/app/api/dev/observability/` read only already-persisted rows — this view never
triggers a new model call.

**Known scope limit**: only the four core analyze-stage calls are linked to an
`analysisId` right now. Practice generation, transfer generation, teach-back evaluation,
recommendation phrasing, and the AI Coach all still call `generateStructured` (so
they're logged with stage/success/cached/latency) but aren't yet tied back to a specific
`analysisId` — extending `generatePracticeProblem`/`evaluateTeachBack`/etc. the same way
is mechanical but wasn't done this pass to keep the change reviewable.

## What's real vs. what's still missing against your spec
**Implemented and wired to persisted state:** reasoning reconstruction + first-divergence
detection, evidence-based gap diagnosis, confidence-aware "ask, don't hallucinate" flow,
RAG over curated chunks, mastery model with trend, knowledge graph relationships used in
recommendations, practice/transfer generation with pre-validation, teach-back rubric
grading, learning memory, AI Coach grounded in that memory, reports built from real
events, a deterministic Visual Lesson Engine for 4 of 7 seeded concepts, a
partially-runnable evaluation fixture set, and an AI Observability trace view for the
core analyze pipeline.

**Not yet built — gaps you should know about before calling this done:**
- **Observability coverage is partial**: practice/transfer/teach-back/coach/recommendation
  calls are logged but not yet linked to a specific analysisId (see above) — the trace
  view will show them as an empty call log even though they happened.
- **Fraction and quadratic/coordinate concepts aren't seeded** in `prisma/seed.ts`, so
  the fraction-bar and coordinate-plane visual components exist but have nothing to
  attach to yet — either seed those concepts or extend `select-visual.ts`'s mapping for
  `quadratics`.
- **Gemini-stage evaluation** (extraction accuracy, classification accuracy) has no
  automated harness or measured numbers — only the deterministic-verifier subset is even
  structured to run without a live API key.
- **The new `AiUsageLog` columns require a schema migration** (`prisma db push` or
  `migrate dev`) before the app will run — this session could not run it (no network/DB).
- **Nothing in this session was executed.** No `npm install`, no build, no dev server,
  no live Gemini call — every new file here is unverified by anything other than manual
  reading, including the observability API routes and pages. Treat it as a diff to
  review and test, not as tested code.

## Recommendation
This is a real multi-file Next.js + Prisma app, not something safe to keep extending
blind in a sandbox with no package installation, no build step, and no way to run Gemini
calls to check output shape. The productive next step is opening this repo in **Claude
Code** (desktop, terminal, or VS Code extension), where I can `npm install`, run the dev
server, actually call Gemini, and build+test the Visual Lesson Engine, observability view,
and eval harness against real output instead of writing them uncompiled here.
