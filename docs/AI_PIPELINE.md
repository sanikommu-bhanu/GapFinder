# AI pipeline

How a photograph becomes a diagnosed misconception, which parts a model is
allowed to decide, and what happens when every model is unavailable.

---

## The rule

> **AI interprets. Deterministic code verifies.**

A language model is the only thing that can read handwriting or infer what a
student was attempting. It is *not* trustworthy for deciding whether a student
made a mistake — it can be confidently wrong, and **a false accusation is the
worst failure this product can have.**

| Decision | Owner | Why |
| --- | --- | --- |
| What do the marks say? | Gemini vision | Only a model can read it |
| What was the student attempting? | Gemini | Requires reading intent |
| Does step *n* follow from *n−1*? | `mathjs` | Must be provable |
| Where is the first divergence? | `solution-audit.ts` | The core claim |
| What should that step have read? | `solve-step.ts` | Never generated |
| Root error vs. carried consequence? | `solution-audit.ts` | Structural |
| Which misconception is it? | `detect-misconception.ts` | Catalogue signature |
| Which concept broke? | Gemini (fallback: structural) | Needs judgement |
| Is practice work correct? | Same divergence engine | Grading must be exact |
| Is a generated problem valid? | Solved independently | Never show an unverified problem |

Nothing the model says about correctness is trusted, because the divergence is
proved by the verifier immediately afterwards.

---

## Stages

`src/lib/ai/pipeline/orchestrator.ts`. Stage boundaries are written to
`analysis.status` as they are entered — the Analyzing screen polls that, so the
progress a student watches is the real pipeline position, not a timer.

```
POST /api/analyses                      returns 202 in ~250 ms
        │                               (the UI is never blocked)
        ▼
  reading          one multimodal call reads + narrates + classifies
                   → low confidence anywhere? pause and ASK the student
        ▼
  reconstructing   statements carried through; expressions never rewritten
        ▼
  verifying        mathjs checks every transition; the audit runs
                   → first divergence + corrected line computed HERE
        ▼
  classifying      Gemini names the concept, from verified steps only
        ▼
  explaining       RAG-grounded explanation against retrieved chunks
        ▼
  complete
```

### Typed working skips the vision stage entirely

A student who types their steps has already told us exactly what each line
says, which is strictly better evidence than reading a photo. That path runs
the identical verification, divergence, misconception and teaching stages with
**no vision model required at all** — which is why it is the fallback offered
whenever image reading is unavailable.

### One call, not three

Reading, narrating and classifying used to be three requests. That cost three
round-trips and three charges against a free-tier quota for a single photo.
They are now one multimodal call, and the result is carried forward in
`preAnalysed` so later stages never re-ask what they were just told.

This is safe precisely because nothing the model says is trusted.

---

## Provider cascade

`src/lib/ai/ai-client.ts`:

```
cache → Gemini → Groq → the caller's own deterministic fallback
```

Gemini stays first: its vision is the strongest available here and every prompt
is tuned to it. Groq picks up whatever it drops — its free tier is separate
from Google's, so a Gemini rate limit does not stop the product working, and
its inference is fast enough that failing over costs the student almost nothing.

### Retry policy

| Failure | Behaviour |
| --- | --- |
| `quota` | **No retry.** Fail over immediately — a free-tier limit is not transient |
| `no_key` | No retry. Skip to the next provider |
| `unsupported` | No retry. e.g. a text-only provider asked for vision |
| `network` | Retry within the provider, backoff `300 ms × attempt`, `AI_MAX_RETRIES` times |
| `invalid_response` | Retry — schema validation failed, may be transient |

### Every attempt is logged

`AiUsageLog` records `provider:model`, stage, success, cached, latency, error
text and the RAG chunk ids that fed the prompt. `/dev/observability` shows
exactly who answered each call and why the first choice did not.

---

## Quota management

Free tiers are the design constraint, not an afterthought.

| Technique | Where |
| --- | --- |
| **Response cache** | `AiCallCache`, keyed by content hash, 7-day TTL |
| **Request collapsing** | Three pipeline calls became one multimodal call |
| **Context reuse** | `preAnalysed` carries the first call's output forward |
| **Concurrency** | Independent work (concept graph load) overlaps I/O |
| **Structured output** | JSON schema on both providers — no reparse loops |
| **Provider failover** | A separate free tier absorbs the first one's limit |
| **Resource cache** | 14 days — a concept's resources change monthly, not hourly |

The cache key hashes the prompt, system instruction and a **digest** of the
image rather than the image bytes, so cache rows stay small.

**Opening another page never regenerates an analysis.** Every artifact —
extracted steps, reasoning steps, the gap, the corrected solution, the
explanation — is persisted at the moment it is computed and read back
thereafter.

---

## Graceful degradation

Every stage after vision has a deterministic substitute. The product gets
quieter, never broken.

| Unavailable | What happens |
| --- | --- |
| Gemini | Groq serves the same call |
| Gemini **and** Groq (text) | `classify-gap-offline.ts` reads the verified algebra and picks the concept from the *shape* of the error; confidence reported as **low**, and the UI says so |
| Gemini and Groq (explanation) | `offline-explain.ts` surfaces retrieved RAG chunks alongside the verifier's algebraic account |
| Gemini and Groq (practice) | `practice-templates.ts` generates from templates, each solved independently before display |
| **Vision** | No local substitute exists — nothing turns pixels into equations without a model. The failure returns a `TYPE_INSTEAD:` prefix and the UI offers typed working, which runs the *identical* pipeline |
| Everything, mid-analysis | Persisted artifacts remain readable; the student keeps what was already computed |

### Failures name the path that still works

`orchestrator.ts` returns prefixed reasons the UI routes on:

- `QUESTION_ONLY:` — a photographed question with no attempt. There is no
  reasoning to diagnose, so the app offers guided solving instead of a dead end.
- `TYPE_INSTEAD:` — image reading failed. Typing gets the same full diagnosis.

When a photo cannot be read *clearly enough to trust*, the pipeline **stops
rather than showing a guess**.

### "Couldn't check" is never reported as "nothing wrong"

If every line came back `uncertain`, the analysis fails with an honest message.
If some lines were unverifiable but the rest hold, the result says so:

> *"2 lines couldn't be checked, but everything we could verify holds."*

Claiming a verification that never happened is the one thing this product must
never do.

---

## RAG

Explanations are grounded in `KnowledgeChunk` rows retrieved per concept and
filtered by kind (`explanation`, `misconception`, `teaching_strategy`).

With a model available, it must ground its wording in the retrieved chunks.
Without one, the chunks are surfaced directly alongside the verifier's account
of what changed. Either way the student reads grounded material — the model
changes the prose, not the substance.

Retrieved chunk ids are recorded per call in `AiUsageLog`, making retrieval
traceable rather than assumed.
