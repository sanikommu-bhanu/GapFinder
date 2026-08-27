# Testing

What is verified, what is measured, and — just as importantly — what is not.

---

## Running everything

```bash
npm run verify   # lint + typecheck + unit tests + deterministic eval
```

**This passes with no API keys at all.** Every stage it exercises is
deterministic, which is the point: the load-bearing claims of this product do
not depend on a model being reachable.

Individually:

```bash
npm run lint
npm run typecheck
npm test                  # vitest
npm run eval:deterministic
```

---

## Current results

Measured on this machine at the time of writing:

| Suite | Result |
| --- | --- |
| ESLint | No warnings or errors |
| `tsc --noEmit` | Clean |
| Unit tests | **219 passed** across 13 files |
| Deterministic eval | **13 passed · 0 failed · 2 skipped** |
| Divergence-detection accuracy | **100%** on scored cases |
| `next build` | Succeeds; 87.3 kB shared JS, largest route ~123 kB |

The two skipped eval cases need image fixtures — see **Known gaps**.

---

## Unit tests

| File | What it pins |
| --- | --- |
| `math-verifier.test.ts` | Step-to-step validity |
| `divergence.test.ts` | First-divergence location |
| `solution-audit.test.ts` | Root error vs. carried consequence |
| `solve-step.test.ts` | Derived corrected lines |
| `guided-solve.test.ts` | Step-at-a-time solving |
| `practice-generation.test.ts` | Generated problems are independently solvable |
| `prediction.test.ts` | Prediction/mastery scoring |
| `exam-verdict.test.ts` | Exam grading |
| `concept-explainer.test.ts` | Concept routing and lesson assembly |
| `multi-subject.test.ts` | Chemistry/biology verifiers |
| `providers.test.ts` | Provider configuration, vision opt-in, model selection |
| `resources-registry.test.ts` | Subject gating and the research relevance gate |
| `navigation.test.ts` | Tab bar routing consistency |

### Two guards worth calling out

**`navigation.test.ts`** parses `BottomNav`'s `items` and `MainLayout`'s
`TAB_ROUTES` from source and asserts they match in both directions. This
existed as a live bug: `/learn` was a tab that was not in `TAB_ROUTES`, so
tapping it navigated to a page with no tab bar. The lists live in different
files for good reasons, which is exactly why nothing stopped them drifting.

**`resources-registry.test.ts`** pins the *silences* — the cases where
returning nothing is correct. A paper on "distributive lattices" must be
rejected for a distributive-property gap; a concept with only generic anchors
must not be searched at all.

---

## Deterministic eval

`npm run eval:deterministic` runs `eval/fixtures/reasoning-cases.json` through
the real verification and divergence engine.

Fifteen fixtures covering: correct work, a single root error, a root error with
downstream consequences, multiple independent errors, fractions, negatives,
distribution, word problems, and **alternative valid approaches** — work that
reaches the right answer by a different route and must *not* be flagged.

That last category is the one that matters most: a tool that flags an unusual
but valid method is worse than useless.

---

## Manual test matrix

Not automated. Walked by hand before a release.

**Core path** — new user · existing user · photo upload · typed working ·
diagnosis · first gap · reasoning replay · visual · voice · practice ·
transfer · teach-back · verification · mastery update

**Degradation** — no API keys · invalid API keys · Gemini quota exceeded
(Groq takes over) · both providers down (deterministic path) · slow API ·
retry · empty research · cached-only state

**Spotify** — not configured · configured but not connected · connected free
tier · connected Premium · expired refresh token · playback with no active
device · user denies consent · `state` mismatch

**Session** — login · logout · refresh · expired session · direct navigation
to a protected route while signed out

**Layout** — mobile portrait · browser resize · tab bar presence on every tab ·
scroll past the fold

**Standards** — no console errors · no dead buttons · no infinite spinners ·
no broken links · no fabricated success

---

## Known gaps

These are real and unfixed. Stating them is more useful than implying coverage
that does not exist.

- **Only single-variable linear algebra is genuinely verified.** That covers
  linear equations, distribution and rearrangement completely, plus the
  symbolic half of physics and chemistry working. It does not verify units,
  and diagram reading is not attempted. The capture screen states this per
  subject rather than implying full support.

- **Model-stage accuracy is unmeasured.** The deterministic layers are at 100%
  on the fixture set. Handwriting extraction and concept classification have no
  automated harness and therefore no numbers — the honest answer is "we don't
  know", not an estimate.

- **No image fixtures.** The handwriting stage is verified by live manual use
  only, which is why two eval cases skip.

- **No end-to-end suite.** The critical path is walked manually in a browser
  and via the API. There is no Playwright or Cypress run guarding it.

- **No integration tests against live external APIs.** OpenAlex, Crossref,
  arXiv, YouTube, GitHub and Spotify are exercised manually. Their *failure*
  handling is unit-tested; their success paths are not, because pinning them
  would mean either network flakiness in CI or fixtures that drift from
  reality.

- **No load testing.** Concurrency behaviour under real classroom traffic is
  unknown.
