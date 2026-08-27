# Research pipeline

How a diagnosed misconception becomes a short list of real papers a student can
actually open — and why returning nothing is often the correct answer.

---

## The constraint

> **A model is never asked for a title, an author, a DOI or a URL.**

A fabricated citation that looks correct is worse than no citation at all,
because a student would cite it. Every field displayed comes back from a
provider API and carries its provenance. A result with nothing resolvable is
dropped rather than shown.

This is why the research layer contains no prompt.

---

## Sources

All three are free, keyless, and authoritative.

| Source | What it is | Why it's here |
| --- | --- | --- |
| **OpenAlex** | Open index of scholarly works | Carries `open_access.oa_url` — a *readable* full text, not a paywall |
| **Crossref** | The DOI registry every major publisher writes to | Authoritative metadata |
| **arXiv** | Canonical preprint server | Physics/CS education preprints the others miss |

They overlap heavily — the same study is routinely in OpenAlex and Crossref
both — so results are deduplicated before ranking.

---

## The query problem

The misconception's display name is prose: *"Losing the sign when distributing
a negative"*. Searching that verbatim matches on filler words. It once returned
a paper about **losing weight**.

So each concept slug maps to the terms the literature actually uses:

```ts
const CONCEPT_TERMS = {
  "sign-handling": ["signed numbers", "negative numbers", "algebra errors"],
  distribution:    ["distributive property", "algebra errors"],
  kinematics:      ["kinematics", "physics education"],
  // …
};
```

### Concepts with no distinctive term return nothing

`hasUsableAnchors()` requires at least one term longer than four characters
that is not a generic word. A concept whose only anchors are "problem" and
"solving" cannot be matched against a corpus of millions, so it is not searched
at all.

---

## The relevance gate

Providers rank by text relevance across their whole corpus, which for a short
query can surface something that merely shares a common word. Two deterministic
gates run on every result.

### Gate 1 — is it on-concept?

At least one **distinctive anchor** must appear in the title or abstract.
Generic anchors are excluded by name:

```
education, errors, error, concept(s), problem(s),
solving, student(s), learning, number(s)
```

Without this exclusion, `"physics education"` anchored on `"education"` and
matched a chemistry paper to both a physics *and* a biology concept. The anchor
must be `"physics"`.

### Gate 2 — is it about teaching?

A paper on *distributive lattices* mentions "distributive" and teaches a
student nothing. So a result must also carry an education signal:

```
student, misconception, teaching, learner, education,
classroom, pedagog, curriculum, instruction
```

Both gates must pass. A result scoring below 2 is discarded.

---

## Ranking

Survivors are ordered by:

1. **Open access first** — a paper the student can open in full beats one
   behind a paywall.
2. **Newer first** among equals.

Capped at **four**. The brief for this panel is *"best for you"*, not
"everything we could find" — a student shown fifty links reads none of them.

---

## Deduplication

DOI is the reliable identity. Where one is absent, a normalised title
(lowercased, punctuation stripped) is close enough to catch the duplicate
without merging two genuinely distinct works.

---

## Caching

Bundles are cached in `AiCallCache` under
`resources:v2:{subject}:{conceptSlug}:{misconception}` for **14 days**. The
same gap produces the same query every time, and a concept's literature changes
on the scale of months.

The key is versioned. Adding OpenAlex and GitHub changed what a bundle
contains, and a stale two-week entry would keep serving the old shape.

---

## Timeouts and failure

Every provider has a **6-second** timeout and runs concurrently via
`Promise.allSettled`, so the slowest sets the wait rather than the sum. A
student never waits on Crossref to see their diagnosis — the resource panel
loads separately, after the diagnosis is already on screen.

Four outcomes, kept distinct:

| Outcome | Student sees |
| --- | --- |
| Provider threw or timed out | *"Crossref: Couldn't be reached just now."* |
| Asked, nothing relevant | *"No closely matching papers were found for this concept."* |
| Concept has no usable anchors | Nothing — not searched |
| Subject not supported (GitHub) | Nothing — correct, not a failure |

An empty panel with no explanation looks broken, so every silence is named.

---

## What the student is told

Each result carries a `why` assembled from the diagnosis, so it is specific and
checkable rather than "this looks relevant":

> *"Free full text on losing the sign when distributing a negative — the
> misconception behind your gap."*

And the panel states its own provenance:

> *"Retrieved live from OpenAlex, Crossref and arXiv. Titles, authors and DOIs
> are theirs, not ours."*
