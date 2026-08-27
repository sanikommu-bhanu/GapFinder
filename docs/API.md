# API

Every route, generated from the actual handlers in `src/app/api/`.

---

## Conventions

**Authentication.** Every route except the four public auth endpoints requires
a valid `gf_session` cookie. `src/middleware.ts` verifies the JWT signature and
returns `401 {"error": "Not authenticated."}` for unauthenticated `/api/*`
requests; each handler independently calls `getSessionUserId()` as defence in
depth.

**Ownership.** Records are always scoped by `userId` inside the query. A
record belonging to another user returns **404, not 403** — the existence of
another student's data is not disclosed.

**Validation.** Mutating routes validate their body with `zod` and return
`400` on failure.

**Errors.** All errors are `{"error": "<human-readable sentence>"}`. Messages
are written for the student, not the developer.

| Status | Meaning |
| --- | --- |
| `200` | Success |
| `202` | Accepted — analysis started, poll for status |
| `400` | Body failed validation |
| `401` | No valid session |
| `404` | Not found, or not yours |
| `409` | Conflict — a fixable state (e.g. no active Spotify device) |
| `403` | Forbidden by an upstream policy (e.g. Spotify Premium required) |
| `503` | An integration is not configured on this server |

---

## Auth

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Creates user + profile. bcrypt hash. Sets session |
| `POST` | `/api/auth/login` | Sets `gf_session`. **No rate limiting** — see SECURITY.md |
| `POST` | `/api/auth/logout` | Clears the cookie. The JWT itself stays valid until expiry |
| `GET` | `/api/auth/me` | Current user + profile. Returns `null` user when signed out |

---

## Analysis — the core pipeline

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/api/analyses` | Starts an analysis. **Returns `202` in ~250 ms** and runs the pipeline in the background — the UI is never blocked |
| `GET` | `/api/analyses` | List for the current user |
| `GET` | `/api/analyses/[id]` | Full result: steps, reasoning, gap, corrected solution |
| `GET` | `/api/analyses/[id]/status` | Poll target. Returns the **real pipeline stage**, not a timer |
| `POST` | `/api/analyses/[id]/confirm` | Resumes after a low-confidence handwriting pause, using the student's corrections. Does **not** re-call the vision model |
| `GET` | `/api/analyses/[id]/report` | Shareable report |
| `GET` | `/api/uploads/[id]` | The stored image. Scoped by owner |

### Pipeline status values

`reading` → `reconstructing` → `verifying` → `classifying` → `explaining` →
`complete`

Plus two terminal states: `needs_confirmation` (handwriting was ambiguous —
the student is asked before anything is claimed) and `failed`.

### Prefixed failure reasons

`statusReason` may carry a prefix the UI routes on, so a failure names the path
that still works:

| Prefix | Meaning | UI offers |
| --- | --- | --- |
| `QUESTION_ONLY:` | A photographed question with no attempt | Guided solving (`/solve`) |
| `TYPE_INSTEAD:` | Image reading unavailable | Typed working — same full diagnosis |

---

## Gaps, practice and verification

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/gaps` | All gaps + overall mastery. `?status=open\|repaired\|closed` |
| `GET` | `/api/gaps/[id]` | One gap, with divergence, explanation, mastery and a teach-back question built from the student's own expressions |
| `POST` | `/api/gaps/[id]/practice` | Generates targeted practice. Every problem is **solved independently before display** |
| `POST` | `/api/gaps/[id]/teach-back` | Grades a spoken/typed explanation against a rubric |
| `POST` | `/api/practice-attempts` | Records an attempt; updates mastery |
| `POST` | `/api/transfer-attempts` | Transfer task — tests whether the repair generalises |
| `POST` | `/api/exam` | Exam mode: no hints |

---

## Learning and explanation

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/api/explain` | Explains a concept. Routes to a curated concept or generates one |
| `POST` | `/api/solve` | Guided step-by-step solving for a question with no working |
| `POST` | `/api/coach` | Conversational coach |
| `GET` | `/api/concept-image` | Generated illustration for a concept |
| `GET` | `/api/knowledge` | RAG chunks |
| `GET` | `/api/misconceptions` | The misconception catalogue |

---

## Resources

All three return the same `ResourceBundle`:

```jsonc
{
  "videos": [ /* LearningResource[] */ ],
  "papers": [ /* LearningResource[] */ ],
  "code":   [ /* LearningResource[] — CS/Engineering only, may be absent */ ],
  "unavailable": [ { "provider": "Crossref", "reason": "Couldn't be reached just now." } ]
}
```

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/gaps/[id]/resources` | Sharpened by the diagnosed misconception |
| `GET` | `/api/concepts/[slug]/resources` | For a concept with no gap yet |
| `GET` | `/api/resources?topic=&subject=` | For a topic outside the curated library |

`unavailable` is **not** an error — it is how the layer reports an honest
silence. See [`RESEARCH_PIPELINE.md`](RESEARCH_PIPELINE.md).

### `LearningResource`

```ts
{
  id: string;
  kind: "video" | "paper" | "article" | "interactive";
  provenance: "verified" | "search";  // "search" = a query, not a recommendation
  title: string;
  url: string;
  source: string | null;              // channel, journal, or "Lang · N stars"
  year: number | null;
  authors: string[];
  summary: string | null;             // the provider's own, never model-written
  why: string;                        // assembled from the diagnosis
}
```

`provenance: "search"` is labelled in the UI as *"Search — we haven't vetted
specific videos"*. The distinction is the whole point.

---

## Spotify

Optional. When the server has no Spotify credentials, `/api/spotify/player`
returns `{"state": "unconfigured"}` and the UI renders nothing.

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/spotify/login` | Redirects to Spotify. Sets httpOnly `state` **and PKCE `verifier`** cookies. `503` if unconfigured |
| `GET` | `/spotify/callback` | **Canonical redirect URI.** Validates `state`, checks the PKCE verifier, exchanges the code, stores tokens. **Always redirects to `/focus?spotify=<outcome>`** — never renders a JSON error |
| `GET` | `/api/spotify/callback` | The original path, retained so an existing dashboard entry keeps working. Delegates to the same handler |
| `GET` | `/api/spotify/status` | `{configured, connected, isPremium, displayName}`. Returns **no token** |
| `GET` | `/api/spotify/player` | Current track. Returns no token |
| `POST` | `/api/spotify/control` | `{action: "play"\|"pause"\|"next"\|"previous", deviceId?}` |
| `POST` | `/api/spotify/disconnect` | Deletes the stored token pair outright |

### Callback outcomes

`connected` · `denied` · `state_mismatch` · `exchange_failed` ·
`unauthenticated` · `misconfigured`

Both callback paths share one implementation
(`lib/spotify/handle-callback.ts`) — two copies of a security-sensitive
handshake is how one of them quietly stops matching the other.

Both are exempt from the middleware session gate, so the handler itself runs
and can spend its single-use cookies and report an outcome. This exposes
nothing: the handler links an account *to a session*, and without one it does
exactly nothing.

### `/api/spotify/player` states

`unconfigured` · `disconnected` · `idle` · `playing` · `unreachable`

`idle` is Spotify's 204 (nothing playing, no active device) — the common case
just after connecting. It is **not** an error.

### `/api/spotify/control` failures

| Status | `reason` | Meaning |
| --- | --- | --- |
| `403` | `premium_required` | Spotify requires Premium for all playback control |
| `409` | `no_device` | Premium, but Spotify is open nowhere. *"Open Spotify and press play once."* |
| `409` | — | Not connected |
| `502` | — | Spotify unreachable |

---

## Profile, progress and settings

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/history` | Past analyses |
| `GET` | `/api/roadmap` | Learning roadmap |
| `GET` | `/api/achievements` | Earned + available |
| `GET` | `/api/reports/full` | Full progress report |
| `GET` | `/api/settings` | Settings + study preferences. Upserts defaults |
| `PATCH` | `/api/settings` | Partial update, zod-validated |
| `POST` | `/api/onboarding` | Grade level, subjects, goals |

---

## Development

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/dev/observability` | Every AI call: provider, model, stage, latency, cached, error |
| `GET` | `/api/dev/observability/[id]` | One analysis's full trace, including RAG chunk ids |

This is how you answer "which provider actually served that call, and why
wasn't it the first one".
