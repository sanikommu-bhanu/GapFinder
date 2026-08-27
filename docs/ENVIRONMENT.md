# Environment

Every variable GapFinder reads, what breaks without it, and where it is read.

**All configuration is read through `src/lib/env.ts` and nowhere else.** There
is exactly one exception, documented below. No variable is prefixed
`NEXT_PUBLIC_`, which is the mechanism that would place a value in the browser
bundle — grep for it and you will find none.

Copy [`.env.example`](../.env.example) to `.env` and fill in. `.env` is
gitignored and is not tracked by this repository.

---

## Required — the app will not run without these

| Variable | Secret | Without it |
| --- | --- | --- |
| `DATABASE_URL` | yes | Nothing works; every route 500s |
| `SESSION_SECRET` | yes | Production **fails at boot**; dev uses a known fallback |
| `GEMINI_API_KEY` | yes | No handwriting reading; typed working still fully diagnoses |

### `SESSION_SECRET`

Generate with `openssl rand -base64 32`. Must be at least 16 characters.

There is deliberately **no production fallback**. A deploy that forgets this
throws at boot rather than verifying sessions against a value published in the
source — anyone who read `env.ts` would otherwise be able to mint a valid login
cookie for any account.

In development, a known placeholder is used so a fresh clone runs immediately.

### `DATABASE_URL`

PostgreSQL in every environment. Any free Postgres works — Neon, Supabase,
Vercel Postgres.

```bash
npm run db:push   # apply the schema
npm run db:seed   # load the concept graph and knowledge chunks
```

Schema changes are pushed from a dev machine, never during a deploy build.

> **Neon's free tier suspends an idle endpoint.** If `db:push` reports
> `P1001: Can't reach database server`, the endpoint is asleep — open the Neon
> console to resume it. This is the single most common local failure.

---

## AI providers

| Variable | Default | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Free from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Text stages |
| `GEMINI_VISION_MODEL` | `gemini-2.5-flash` | Handwriting reading |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` | Concept illustrations |
| `GROQ_API_KEY` | — | Free, no card, [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Fallback text model |
| `GROQ_ALLOW_VISION` | `false` | Vision fallback is opt-in |
| `GROQ_VISION_MODEL` | *(none)* | No default on purpose |

**Why Groq vision is opt-in.** Reading handwriting is the one stage where model
quality visibly changes the answer. A weaker fallback that misreads a line
produces a confident diagnosis of a mistake the student never made — the worst
failure this product can have. So it must be chosen deliberately.

Model ids rotate faster than this file. If a default retires:

```bash
curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
```

### Tuning

| Variable | Default | Notes |
| --- | --- | --- |
| `AI_CACHE_TTL_HOURS` | `168` (7 days) | How long a cached model response stays valid |
| `AI_MAX_RETRIES` | `2` | Retries **within** one provider before failing over |

Quota errors are never retried regardless of this value.

---

## Optional integrations

Each of these is genuinely optional. The table says what is lost, and nothing
in it is "the app breaks".

| Variable | Secret | Without it |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | yes | Videos degrade to a labelled search handoff |
| `OPENALEX_MAILTO` | **no** | Lower rate limit; results unchanged |
| `GITHUB_TOKEN` | yes | 10 req/min instead of 30; discovery still works |
| `SPOTIFY_CLIENT_ID` | no* | Focus music card renders nothing |
| `SPOTIFY_CLIENT_SECRET` | **yes** | *Optional.* Flow falls back to public-client PKCE |
| `SPOTIFY_REDIRECT_URI` | no | Focus music card renders nothing |

\* The Spotify client id appears in the authorize URL by design and is not a
secret. It is still read through `env.ts` so the integration has one home.

### `OPENALEX_MAILTO`

Not a credential. OpenAlex asks callers to identify themselves with an email
and rewards the "polite pool" with better throughput. Leave blank to opt out.

### Spotify

The flow is **Authorization Code with PKCE**. `hasSpotifyConfig()` requires
only `SPOTIFY_CLIENT_ID` and `SPOTIFY_REDIRECT_URI` — PKCE proves the token
request came from the browser that started the flow without any shared secret.

`SPOTIFY_CLIENT_SECRET` is **optional but recommended**: with it the app also
authenticates as a confidential client (Basic auth), which is strictly stronger
than PKCE alone and is appropriate here because GapFinder has a server that can
hold a secret. Without it, the flow runs as a public client with `client_id` in
the token body.

A half-set config is still treated as none: the card would otherwise offer a
Connect button landing on a Spotify error page.

The redirect URI must match the Spotify dashboard **character for character**,
including the port and trailing path:

```
http://127.0.0.1:3000/spotify/callback
```

Register **both** your local and production URIs in the dashboard. The legacy
`/api/spotify/callback` path also still resolves, so an older dashboard entry
does not break.

> Spotify no longer accepts `localhost` in redirect URIs for new apps — use
> `127.0.0.1`. In production this must be your real HTTPS origin.

See [`INTEGRATIONS.md`](INTEGRATIONS.md#spotify--read-this-before-relying-on-it)
for the Premium and development-mode limits.

---

## The one exception to central reads

`src/middleware.ts` reads `process.env.SESSION_SECRET` directly rather than
importing `env.ts`.

This is deliberate. Middleware runs in the **edge runtime**, and `env.ts`
throws at module load when `SESSION_SECRET` is missing in production. An edge
module that throws on import takes down every request including the public
pages — so middleware reads the raw value and, finding it absent or too short,
rejects every session rather than crashing.

The check is stricter, not looser: middleware has no development fallback at
all.

---

## Verifying your setup

```bash
npm run verify   # lint + typecheck + unit tests + deterministic eval
```

This passes with **no API keys at all** — every stage it exercises is
deterministic. If `verify` passes but the app misbehaves, the problem is
configuration, not code. Start at [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
