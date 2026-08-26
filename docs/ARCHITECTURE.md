# GapFinder — Architecture

How the system is put together, and why each boundary sits where it does.

---

## 1. The governing constraint

Every design decision in this codebase descends from one rule:

> **AI interprets. Deterministic code verifies.**

A language model is excellent at reading handwriting, at inferring what a student meant by an ambiguous scrawl, and at mapping "how do plants make food" onto a topic. It is not a source of truth about whether `2x = 15 + 7` follows from `2x + 7 = 15`.

So the two capabilities are separated at the architectural level, not merely by prompt engineering.

```mermaid
flowchart TB
    subgraph AI["What a model is allowed to do"]
        direction LR
        A1["Read handwriting<br/>into text"]
        A2["Route a question to<br/>one of 22 fixed slugs"]
        A3["Draft practice problems<br/>(then independently solved)"]
    end

    subgraph CODE["What only code may do"]
        direction LR
        B1["Decide a step is wrong"]
        B2["Compute the corrected line"]
        B3["Choose the numbers<br/>in a diagram"]
        B4["Award or withhold<br/>mastery"]
    end

    AI -.->|"output is input,<br/>never verdict"| CODE

    style AI fill:#F5F3FF,stroke:#8B5CF6,color:#151833
    style CODE fill:#EEF0F8,stroke:#151833,color:#151833
```

The practical test applied to every feature: *if the model returned nonsense here, would a student be told something false?* If yes, the feature is built differently.

---

## 2. Request lifecycle — analysing student work

```mermaid
sequenceDiagram
    participant S as Student
    participant UI as Capture screen
    participant API as /api/analyses
    participant AI as Provider cascade
    participant V as Verification layer
    participant D as Diagnosis
    participant DB as PostgreSQL

    S->>UI: Photograph working
    UI->>UI: Downscale + compress client-side
    UI->>API: base64 + subject
    API->>DB: Create analysis (status: processing)
    API-->>UI: analysisId (immediate)
    UI->>S: Reasoning replay begins

    API->>AI: One combined multimodal call
    AI-->>API: Structured steps
    API->>V: Verify each pair of lines
    V->>V: Route by shape → algebra / quantitative / chemical
    V-->>API: Per-line verdicts + corrected expressions
    API->>D: Locate first divergence
    D->>D: Match against misconception catalogue
    D->>DB: Retrieve grounding chunks (TF-IDF)
    D-->>API: Gap + explanation + evidence
    API->>DB: Persist (status: complete)
    UI->>API: Poll
    API-->>UI: Diagnosis
    UI->>S: First gap, audit, lesson
```

The `analysisId` returns before the pipeline finishes. The replay animation is not a loading spinner dressed up — it is real elapsed work, shown as reasoning being reconstructed.

---

## 3. Verification layer

The layer that actually decides. Every pair of adjacent lines is routed by **shape**, not by the subject the student selected — a chemistry paper is full of algebra, and the algebra in it is still checkable algebra.

```mermaid
flowchart TB
    IN["Two adjacent lines"] --> SHAPE{"What shape<br/>is this?"}

    SHAPE -->|"contains an arrow<br/>and formulae"| CHEM["Chemical verifier"]
    SHAPE -->|"carries units"| QUANT["Quantitative verifier"]
    SHAPE -->|"algebraic relation"| ALG["Algebraic verifier"]
    SHAPE -->|"prose"| NONE["Not verifiable —<br/>reported as such"]

    CHEM --> C1["Count atoms, nested<br/>groups included"]
    C1 --> C2["Compare species formulae,<br/>not just element sets"]
    C2 --> C3["Catch subscript changes<br/>H2O → H2O2"]

    QUANT --> Q1["Evaluate arithmetic"]
    Q1 --> Q2["Check dimensional<br/>consistency via mathjs"]

    ALG --> A1["Parse to linear form"]
    A1 --> A2{"Enough constraints<br/>to verify?"}
    A2 -->|"3 free variables"| NONE
    A2 -->|Yes| A3["Compare solution sets"]

    C3 --> OUT["Verdict + corrected line"]
    Q2 --> OUT
    A3 --> OUT
    NONE --> OUT

    style NONE fill:#EEF0F8,stroke:#151833,color:#151833
    style OUT fill:#22C55E,stroke:#151833,color:#FFFFFF
```

### The free-variable guard

`v = u + a*t` has three unknowns. No single line can be verified against it, and an early version of the verifier accused students who were entirely correct. The guard counts free variables and returns **"could not verify"** rather than a verdict.

An honest "I can't check this" costs a student nothing. A false accusation costs the product their trust permanently.

---

## 4. Diagnosis: from a wrong line to a named misconception

```mermaid
flowchart TB
    D["First divergence located"] --> SIG{"Algebraic signature<br/>match?"}

    SIG -->|"constants differ<br/>by exactly 2b"| M1["M-TRANSPOSE-SIGN<br/>proved"]
    SIG -->|"one bracket term<br/>untouched"| M2["M-DISTRIBUTE-FIRST-ONLY<br/>proved"]
    SIG -->|"subscript altered"| M3["C-SUBSCRIPT-CHANGED<br/>proved"]
    SIG -->|No signature| MOD["Model proposes a code<br/>from the fixed catalogue"]

    MOD --> CHECK{"Code exists in<br/>catalogue?"}
    CHECK -->|Yes| M4["Matched — labelled<br/>as matched, not proved"]
    CHECK -->|No| UNC["UNCLASSIFIED —<br/>says so plainly"]

    M1 --> OUT["Gap record"]
    M2 --> OUT
    M3 --> OUT
    M4 --> OUT
    UNC --> OUT

    style M1 fill:#22C55E,stroke:#151833,color:#FFFFFF
    style M2 fill:#22C55E,stroke:#151833,color:#FFFFFF
    style M3 fill:#22C55E,stroke:#151833,color:#FFFFFF
    style UNC fill:#EEF0F8,stroke:#151833,color:#151833
```

Some misconceptions have an **algebraic signature** — a fingerprint in the numbers themselves. Transposing without inverting means the constants differ by exactly twice the transposed term. That is provable, and when it is proved the app says "proved" rather than "probably".

Where no signature exists, a model may select from the catalogue, and the difference in certainty is carried through to the interface.

---

## 5. Retrieval

A curated corpus of 58 chunks across 22 concepts, searched with local TF-IDF. No embedding API, no vector database, no recurring cost.

```mermaid
flowchart LR
    Q["Query"] --> T["Tokenise + stem"]
    T --> SC["TF-IDF against the<br/>concept's chunks"]
    SC --> F{"Anything<br/>scored?"}
    F -->|Yes| R["Ranked results"]
    F -->|"No, and the student<br/>asked about this concept"| ALL["All of the concept's chunks,<br/>ordered by teaching value"]
    F -->|"No, and this is a<br/>citation for an error"| EMPTY["Nothing —<br/>cite nothing rather than<br/>something irrelevant"]

    style R fill:#22C55E,stroke:#151833,color:#FFFFFF
    style ALL fill:#F5F3FF,stroke:#8B5CF6,color:#151833
```

The two fallback paths are deliberately different. Scoring is meant to *order* results; when a student asks about a concept by name, everything filed under that concept is relevant by construction and the score should not gate it. When retrieving evidence to justify a specific diagnosis, an unrelated chunk is worse than none.

---

## 6. Visuals

Ten renderers. Every parameter is computed — from the student's own verified working during a diagnosis, or from a curated worked example when explaining a concept.

```mermaid
flowchart TB
    C["Concept + verified expression"] --> SEL["selectConceptVisual()"]

    SEL --> M["Balance scale<br/>Number line<br/>Area model<br/>Factor tree<br/>Fraction bar<br/>Coordinate plane"]
    SEL --> S["Atom balance<br/>Electron shells<br/>Punnett square<br/>Process flow<br/>Cell comparison"]
    SEL --> N["none →<br/>plain explanation instead"]

    style M fill:#F5F3FF,stroke:#8B5CF6,color:#151833
    style S fill:#F0FDF4,stroke:#22C55E,color:#151833
    style N fill:#EEF0F8,stroke:#151833,color:#151833
```

### The `allowCuratedExample` boundary

Curated examples — the physics relationship graphs, the parabola, the sodium atom — are correct statements about their concept, and say nothing about *this* student's working. Drawing one beside a diagnosis would put a picture on screen that the student's own lines cannot be checked against.

So they are **off by default** and enabled only on the explainer path, where no student working exists. A test asserts that a diagnosis context never renders one.

---

## 7. Provider cascade

```mermaid
flowchart TB
    R["generateStructured()"] --> CK{"Cache hit?"}
    CK -->|Yes| DONE["Return — logged as 'cache'"]
    CK -->|No| G["Gemini"]

    G -->|Success| SAVE["Cache + log provider"]
    G -->|"Rate limit / outage"| WORTH{"Worth failing<br/>over?"}
    WORTH -->|"No — bad request"| FAIL["Throw; caller falls back"]
    WORTH -->|Yes| GR["Groq"]

    GR -->|Success| SAVE
    GR -->|Unavailable| FAIL

    SAVE --> DONE
    FAIL --> DET["Caller's deterministic path"]
    DET --> DONE

    style DONE fill:#22C55E,stroke:#151833,color:#FFFFFF
    style DET fill:#EEF0F8,stroke:#151833,color:#151833
```

Every attempt is logged with the provider that served it and the latency, visible in the observability view. A malformed request is not retried against a second provider — only failures worth failing over are.

### Schema sanitisation

`zodToJsonSchema` emits `additionalProperties`, which Gemini's structured-output endpoint rejects outright. `to-gemini-schema.ts` reduces every schema to the key subset Gemini accepts, inlining `$ref` and collapsing `anyOf`. Without it, every structured call in the project returns a 400.

---

## 8. Data model

```mermaid
erDiagram
    User ||--o{ Analysis : submits
    User ||--o{ MasteryRecord : holds
    User ||--o{ ExamSession : sits
    Analysis ||--o{ ReasoningStep : contains
    Analysis ||--o{ Gap : yields
    Concept ||--o{ Gap : "diagnosed as"
    Concept ||--o{ KnowledgeChunk : "grounded by"
    Concept ||--o{ ExamQuestion : tests
    Concept ||--o{ ConceptRelationship : "prerequisite of"
    Gap ||--o{ PracticeAttempt : repaired_by
    ExamSession ||--o{ ExamQuestion : contains
```

`Gap.misconceptionCode` is the join that makes longitudinal tracking possible: the same code appearing in a homework diagnosis and in an exam answer is recognised as the same event, because both were produced by the same catalogue.

---

## 9. Security

| Concern | Handling |
|---|---|
| Route protection | `src/middleware.ts` verifies the JWT with `jose` on every protected path |
| Session secret | Rejected if absent or under 16 characters — no silent insecure default |
| Cross-user access | Every query is scoped by `userId`; another user's analysis returns 404, not 403 |
| Login timing | Constant-time comparison; identical response for unknown user and wrong password |
| Uploads | Strict MIME allowlist, size ceiling, client-side downscale before transmission |
| Secrets | Environment variables only; never logged, never returned to a client |

> **Note on middleware placement.** A root-level `middleware.ts` is silently ignored when a `src/` directory exists. It lives in `src/middleware.ts`, and cross-user isolation is verified: no cookie → 307, forged token → 307, valid token → 200, another user's record → 404.

---

## 10. Testing

```
201 tests
├── Verification      Algebraic, chemical, dimensional correctness
├── Diagnosis         Signature detection, catalogue matching
├── Audit             Five-state classification, downstream propagation
├── Exam verdicts     Mastery rules, including refusal to over-claim
├── Concept explainer Intent detection, routing, lessons, quiz construction
├── Fabrication       Citations, URLs, statistics stripped from generated text
└── Eval harness      15 fixtures, deterministic, end-to-end
```

The eval harness is the one that matters most: fixed worked solutions with known error locations, asserting that the pipeline finds the right line. It runs without a model, so a regression in the deterministic core cannot hide behind a good day from an API.

---

## 11. Performance

| Decision | Effect |
|---|---|
| Four Gemini calls collapsed into one combined multimodal call | ~4× fewer round trips per analysis |
| Client-side image downscaling before upload | Large phone photos transmit in a fraction of the bytes |
| `waitUntil` for post-response work | Response returns before background persistence completes |
| Content-hashed AI cache | Repeat questions cost nothing |
| Resource providers run concurrently | Slowest provider sets the wait, not the sum |
| Resources load after the diagnosis renders | A student never waits on an external API to see what they got wrong |

---

## 12. Extension points

**A new subject** needs a verifier in `lib/verification/domains/`, a routing rule in `verify-step.ts`, an entry in `lib/subjects.ts` declaring what it proves versus reviews, catalogue entries in `lib/diagnosis/misconceptions.ts`, and knowledge chunks in the seed.

**A new visual** needs a module variant in `select-visual.ts`, a renderer in `components/visuals/`, and a case in `ConceptVisual.tsx`. The renderer receives computed parameters and draws them — it never calculates.

**A new provider** implements the `AiProvider` interface and joins the `PROVIDERS` array. The cascade, caching, logging and fallback behaviour come for free.
