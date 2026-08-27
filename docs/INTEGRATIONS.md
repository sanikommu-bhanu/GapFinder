# Integrations

Every external service GapFinder talks to, what it costs, what it requires, and
what happens when it is not there.

The governing rule for this whole layer:

> **No integration may be load-bearing.** Remove any single service — or all of
> them — and the diagnosis still runs, the gap is still found, the explanation
> still appears, and the practice still grades. Integrations enrich the
> learning loop; they are never inside it.

---

## At a glance

| Service | Key | OAuth | Cost | Limit | Without it |
| --- | --- | --- | --- | --- | --- |
| **Gemini** | yes | no | free tier | RPM/RPD quota | Falls to Groq |
| **Groq** | yes | no | free tier | RPM/RPD quota | Falls to deterministic layer |
| **OpenAlex** | no | no | free | 100k/day, 10/s | Crossref + arXiv still answer |
| **Crossref** | no | no | free | polite pool | OpenAlex + arXiv still answer |
| **arXiv** | no | no | free | ~1 req/3 s | OpenAlex + Crossref still answer |
| **YouTube** | optional | no | free tier | 10k units/day | Honest search handoff |
| **GitHub** | optional | no | free | 10/min → 30/min with token | Section is omitted |
| **Spotify** | id only | **yes (PKCE)** | free API | see below | Card renders nothing |
| **Voice** | no | no | free | browser support | Lesson still renders as text |

---

## The registry

Resource providers (video, research, code) are registered in
`src/lib/resources/index.ts` against the contract in
`src/lib/resources/registry.ts`:

```ts
interface ResourceProvider {
  id: string;
  label: string;                          // shown when it can't answer
  kind: "video" | "paper" | "code";
  isConfigured(): boolean;                // missing key → skipped, not failed
  supports(query: ResourceQuery): boolean; // subject gating
  search(query, limit): Promise<LearningResource[]>;
}
```

The aggregator maps over the registry with `Promise.allSettled` — the slowest
provider sets the wait, not the sum — and never learns what any provider is.
Adding a source is one file plus one entry.

Three outcomes are distinguished, and the distinction matters:

| Outcome | Meaning | Student sees |
| --- | --- | --- |
| Not configured | No key on this server | Nothing — the feature isn't advertised |
| Declined subject | `supports()` returned false | Nothing — correct, not a failure |
| Threw | Asked, couldn't answer | "Couldn't be reached just now" |
| Returned `[]` | Asked, nothing relevant | "No closely matching papers were found" |

An empty panel that looks broken is itself a bug. Every silence is explained.

---

## AI providers

Cascade, in `src/lib/ai/ai-client.ts`:

```
cache → Gemini → Groq → the caller's own deterministic fallback
```

- A **quota** error is never retried within a provider — a free-tier limit is
  not transient, and waiting out a window that will not move just costs the
  student time. It fails straight through to the next provider.
- A **network** error is retried with backoff, twice by default.
- Every attempt is logged to `AiUsageLog` as `provider:model`, so
  `/dev/observability` shows exactly who answered and why the first choice
  did not.

See [`AI_PIPELINE.md`](AI_PIPELINE.md) for the full stage map.

---

## Research: OpenAlex, Crossref, arXiv

All three are free and keyless. They overlap heavily and are deduplicated by
DOI (falling back to a normalised title).

**No model is ever asked for a title, author, DOI or URL.** A fabricated
citation is the one error a student would repeat in their own coursework, so
every field displayed comes back from a provider API. A result with nothing
resolvable is dropped rather than shown.

OpenAlex earns its place over the other two by carrying `open_access.oa_url` —
a legally free full text a student can actually read, rather than a paywalled
DOI landing page — which is why the ranker prefers it.

`OPENALEX_MAILTO` is **not a credential**. It is the polite-pool identifier
OpenAlex asks callers to send in exchange for better throughput.

See [`RESEARCH_PIPELINE.md`](RESEARCH_PIPELINE.md) for the relevance gate.

---

## YouTube

With `YOUTUBE_API_KEY`, results are real videos, checked as public and
embeddable before display, cached per concept.

Without it, the provider returns a single **search handoff** — a precisely
built query the student runs themselves, labelled in the UI as
"Search — we haven't vetted specific videos".

This is deliberate. The alternative is asking a model for video URLs, which
produces confident, plausible, dead links. A student who clicks three broken
recommendations stops trusting everything else the product says.

---

## GitHub

"See it in the real world" — repository discovery for **Computer Science and
Engineering only**. The provider declines every other subject via `supports()`,
because a repository makes a graph-traversal gap concrete and says nothing about
photosynthesis.

**GapFinder does not clone, execute, analyse or vouch for any repository.** The
claim made to the student is "this concept appears in real code here", which is
exactly what the metadata supports. The UI says so: *"We link to them — we
haven't run them."*

Unauthenticated search is **10 requests/minute**, which a classroom would
exhaust in seconds. Results are cached for 14 days. `GITHUB_TOKEN` is optional
and only raises the limit to 30/min; a fine-grained token with **no scopes**
selected is sufficient, since this reads only public search results.

---

## Spotify — read this before relying on it

Spotify is an **optional Focus Mode enhancement**. Focus Mode — the timer, the
objective, the misconception being repaired, the mastery ring — is complete
without it. When `SPOTIFY_CLIENT_ID` and `SPOTIFY_REDIRECT_URI` are not both
set, `FocusMusicCard` returns `null` and the app never mentions Spotify.
(`SPOTIFY_CLIENT_SECRET` is optional — see the flow below.)

### Real constraints

These are Spotify's rules, not ours, and they are not worked around:

1. **Playback control requires Premium.** Every `/me/player/*` control endpoint
   returns 403 for a free account. The card checks the account `product` first
   and, for a free account, shows what is playing with an honest note instead of
   buttons that would fail.
2. **A new app starts in development mode**, limited to a small number of users
   who must each be added by email in the Spotify dashboard. *Add every account
   that will sign in before a demo.* Extended quota is not something to assume.
3. **30-second `preview_url` was removed** for new apps in late 2024, so the
   classic "no Premium? play a preview" fallback no longer exists.

### What is explicitly not done

No scraping. No downloading or re-hosting of audio. No unofficial player. No
attempt to bypass the Premium requirement. No audio is proxied through
GapFinder — the control endpoints only tell Spotify's own player what to do.

### The flow: Authorization Code with PKCE

`/api/spotify/login` → Spotify consent → `/spotify/callback`

PKCE (RFC 7636) binds the authorization code to the browser that started the
flow. Login generates a random `code_verifier`, sends only its SHA-256 hash as
`code_challenge`, and redeems the code with the original verifier. A code
intercepted from a redirect chain, a proxy log or browser history cannot be
redeemed by anyone else.

GapFinder is a confidential client, so PKCE is **defence in depth rather than a
substitute for a secret**: when `SPOTIFY_CLIENT_SECRET` is set the token call
also authenticates over Basic auth. Without it the flow still works as a public
client — which is why the secret is optional.

Two redirect URIs resolve, both delegating to one handler
(`lib/spotify/handle-callback.ts`):

| Path | Status |
| --- | --- |
| `/spotify/callback` | Canonical |
| `/api/spotify/callback` | Retained so an existing dashboard entry keeps working |

### Token handling

| Where | What lives there |
| --- | --- |
| `SpotifyAccount` table | Access token, refresh token, expiry, scope, product |
| `gf_spotify_state` cookie | Random per-attempt CSRF state, httpOnly, 10 min |
| `gf_spotify_verifier` cookie | PKCE verifier, httpOnly, 10 min, single use |
| Browser JavaScript | **Nothing.** No token, no verifier, no secret, ever |

Both cookies are httpOnly, so page scripts cannot read them, and **both are
deleted on every exit from the callback** — success, refusal or failure — so a
spent attempt cannot be replayed.

The client secret is used only in the two server-side token calls in
`src/lib/spotify/client.ts`. Access tokens are refreshed lazily, on the call
that needs one, with a 60-second skew. **When a refresh is rejected the row is
deleted** — a revoked token and a disconnect are indistinguishable, and both
mean the card should offer to reconnect rather than fail every call forever.

### Scopes requested

`user-read-private` `user-read-email` `user-read-playback-state`
`user-read-currently-playing` `user-modify-playback-state` `streaming`

`user-read-private` is what reveals whether the account is Premium, which is
what decides whether controls render. Nothing here grants library or playlist
access.

### Every state the card can be in

| State | Cause | UI |
| --- | --- | --- |
| `unconfigured` | No keys on the server | Renders nothing |
| `disconnected` | No linked account, or refresh rejected | "Connect" |
| `idle` | Linked, nothing playing anywhere | "Press play in Spotify" |
| `playing` + Premium | Everything works | Artwork, track, transport |
| `playing` + free | Premium-gated | Artwork, track, honest note |
| `unreachable` | Timeout or 5xx | "Your timer is unaffected" + Retry |
| `denied` | Student cancelled consent | "Focus Mode works without it" |
| `state_mismatch` | State or verifier cookie missing/expired | "That sign-in link had expired" |
| `no_device` (409) | Premium, but Spotify open nowhere | "Open Spotify and press play once" |

---

## Voice

`useSpeechOutput` uses the browser's built-in `SpeechSynthesis`. No key, no
network, no cost. A device with no speech engine loses the audio and keeps the
lesson — `TeachMe` always renders the written lines, and speech highlights the
line being spoken when available.

Voice is optional and off-switchable in Settings.
