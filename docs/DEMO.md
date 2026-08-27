# Demo

The path to walk, why each step lands, and exactly what to do when something
fails live.

---

## Before you start

```bash
npm run verify          # must be green
npm run dev
```

**Checklist**

- [ ] Neon endpoint is **awake** (it suspends when idle — this is the #1 live failure)
- [ ] `npm run db:seed` has been run
- [ ] `GEMINI_API_KEY` set and not near its daily quota
- [ ] `GROQ_API_KEY` set — this is your live safety net
- [ ] Spotify: every account that will sign in is **added in the dashboard**
- [ ] Spotify: playing on some device already, so the card isn't `idle`
- [ ] One clean photo of handwritten working ready, **and the same problem typed out** as a backup
- [ ] A second browser profile for the "new user" story

**Run the pipeline once beforehand on the exact problem you'll demo.** The
7-day response cache then makes it near-instant and immune to a quota limit
mid-demo. This is not cheating — it is what the cache is for.

---

## The flow

### 1. The claim (20 s)

> "Every homework tool grades the destination. A student photographs their work
> and is told the answer is wrong. That tells them what they already knew.
>
> The interesting question is **which line stopped following from the one
> above it** — and what rule they were applying when they wrote it, because
> that rule will produce the same error next week."

### 2. Upload (30 s)

`/scan` → photograph the working.

Say what's happening while it runs:

> "The progress you're watching is the real pipeline position, not a timer.
> It's reading, then reconstructing the reasoning, then verifying every line."

### 3. Reasoning replay + first gap — **the money moment** (60 s)

The line-by-line replay lands on the first divergence.

> "A student who makes one conceptual error at line two has five wrong lines.
> Four of them aren't mistakes — they're the faithful consequences of one
> broken idea. Grading all five teaches them they're bad at algebra. Finding
> the one that matters teaches them algebra."

**The point judges should hear:**

> "No language model decided this. The model read the handwriting. `mathjs`
> proved which step doesn't follow, and the corrected line was computed, never
> generated. A model can be confidently wrong, and a false accusation is the
> worst thing this product could do — so it isn't allowed to make that call."

### 4. "Correct answer — incorrect reasoning" (if your fixture has it)

The strongest single demo case. Right answer, broken reasoning, caught anyway.

### 5. Show me (30 s)

The visual is built from **the student's own numbers**, not a stock diagram.
Sixteen visual types across maths, physics, chemistry and biology.

### 6. Teach me (30 s)

> "It names their actual mistake — not 'distribution is a mathematical
> property', but 'you multiplied 3 by x here and left the 4 unchanged'."

The spoken line is highlighted as it's read. Turn it off to show it's optional
and the lesson still stands.

### 7. Learn another way + research (30 s)

> "Nothing here was written by a model. Titles, authors and DOIs come from
> OpenAlex, Crossref and arXiv. A fabricated citation is the one error a
> student would repeat in their own coursework — so no model is ever asked for
> a URL."

If a panel is empty, that's a feature: **read the reason aloud.**

### 8. Focus Mode (30 s)

`/focus` — the block is *about* something: the named misconception, the mastery
it's meant to move.

> "The timer is bound to the gap. And it's the student's own Spotify — but
> pull the keys and this screen is unchanged. No integration is load-bearing."

### 9. Challenge me → verify (45 s)

Targeted practice, graded by the same divergence engine. Every generated
problem was **solved independently before being shown**.

### 10. Close (20 s)

> "It sees the reasoning, finds the gap, explains it visually, speaks to the
> student, connects real research, and verifies the repair. One system — the
> integrations support that. They never become it."

---

## When it fails live

Every one of these is a *recovery you can narrate as a design decision*,
because it is one.

| Failure | Say this, then do this |
| --- | --- |
| **Photo won't read** | "This is why typed working exists." → paste the typed steps. Identical pipeline, no vision model |
| **Gemini quota** | "Free-tier limits are a certainty, not an edge case." → Groq takes over automatically; show `/dev/observability` |
| **Both AI down** | "Every stage after reading has a deterministic substitute." → the diagnosis still runs, confidence shows **low**, and the UI says why |
| **Research empty** | Read the reason aloud. "It asked and found nothing relevant. A confidently irrelevant citation is worse than an empty panel" |
| **Spotify won't connect** | "Spotify caps new apps at a handful of allowlisted users." → the card degrades; Focus Mode is untouched |
| **No Premium** | "Spotify requires Premium for playback control. We show what's playing and don't fake the rest" |
| **DB unreachable** | Neon suspended. Resume in the console. Nothing else recovers this — check it beforehand |

**If you only remember one line:** *nothing here shows a guess.* When GapFinder
can't verify something, it says so — and that is the demo.

---

## What to show a technical judge

| Ask | Where |
| --- | --- |
| "Is the AI making this up?" | `/dev/observability` — provider, model, latency, cache, per call |
| "What if the API is down?" | Unset `GEMINI_API_KEY`, restart, upload typed working. It still diagnoses |
| "Are the papers real?" | Click one. It resolves to a DOI |
| "Is it just a maths app?" | `/scan` → Chemistry or Biology. Different verifier, different visuals |
| "How do you handle quota?" | `AI_PIPELINE.md` — cache, call collapsing, context reuse, failover |
| "Are the keys safe?" | `SECURITY.md` — three greps that each return nothing |

---

## The 60-second version

Upload → **first gap** → show me → teach me → verify.

Cut research, Spotify and transfer. The core claim is the divergence, and it
lands in fifteen seconds.
