# Troubleshooting

Symptoms and their actual causes, ordered by how often they happen.

---

## Setup

### `P1001: Can't reach database server` / `TypeError: fetch failed`

Two different causes look identical. Check them in this order.

**1. Broken IPv6 route (most common, and misleading).**

Neon publishes both A and AAAA records. Node and Prisma may pick the IPv6
address, and on many home and campus networks there is no working IPv6 route —
the connection hangs for the full timeout and reports the host as unreachable.

The tell is that a plain TCP test *succeeds* while the client fails:

```bash
# PowerShell — if this says True, the endpoint is up and the problem is routing
Test-NetConnection ep-xxxx.neon.tech -Port 5432
```

and that **retrying sometimes works** — that is the resolver occasionally
returning the IPv4 record first, which makes it look like a flaky database.

`scripts/apply-sql.ts` pins `dns.setDefaultResultOrder("ipv4first")`, so
`npm run db:apply` is immune. The Prisma CLI resolves in its own Rust engine
and is not covered, so when `db push` fails this way, apply the SQL over HTTPS
instead:

```bash
npm run db:apply prisma/manual/<file>.sql
```

Or force it for a single command:

```bash
NODE_OPTIONS=--dns-result-order=ipv4first npx prisma db push
```

**2. A suspended endpoint.** Neon's free tier suspends after inactivity. The
first query wakes it and may itself fail; run it twice. If it never wakes,
resume it from the Neon console.

Otherwise check `DATABASE_URL` is set and includes `?sslmode=require`.

### `EPERM: operation not permitted, rename … query_engine-windows.dll.node`

On Windows, `prisma generate` cannot replace the query engine while a process
is using it. Stop the dev server and retry:

```powershell
Get-Process node | Where-Object {
  (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*gapfinder*'
} | Stop-Process -Force
npx prisma generate
```

### `SESSION_SECRET is missing or too short`

Production refuses to boot without one. This is deliberate — a published
fallback secret would let anyone mint a login cookie.

```bash
openssl rand -base64 32
```

### The concept graph has not been seeded

`"The concept graph has not been seeded yet. Run npm run db:seed."`

```bash
npm run db:seed
```

### Every protected page is publicly reachable

`middleware.ts` must live in **`src/`**. With a `src` directory, Next.js does
not look for middleware at the repository root and a root copy is silently
ignored.

---

## Analysis

### "We could not read any working steps in that image"

The photo was read, but no equations were found. One problem per photo,
straight-on, well lit, one step per line.

### "This is a question with no working yet"

Working as designed. The page shows a question with nothing attempted, so there
is no reasoning to diagnose. The UI offers **Solve With Me** instead.

### "The image reader has hit its rate limit for now"

Gemini's free-tier quota. **Type the working out instead** — that path runs the
identical pipeline (verification, divergence, misconception, teaching) and does
not use the image reader at all.

Optionally set `GROQ_API_KEY` so text stages fail over rather than dropping to
the deterministic layer.

### "We couldn't read this as mathematical working"

Every line came back unverifiable. Each line must be an equation. This message
appears instead of a false "everything looks fine" — claiming a verification
that never happened is the one thing the product must not do.

### Confidence is reported as low

Expected when both AI providers were unavailable and
`classify-gap-offline.ts` classified the gap from the shape of the error alone.
The diagnosis is still real — the divergence is always computed
deterministically — but concept selection had no model behind it, and the UI
says so.

### Analysis seems stuck

Poll `/api/analyses/[id]/status`. The value is the real pipeline stage. Check
`/dev/observability` for the failing call and which provider served it.

---

## Resources

### The research panel is empty

Check the `unavailable` list in the response — it always explains the silence.

| Message | Cause |
| --- | --- |
| *"No closely matching papers were found"* | Asked, nothing passed the relevance gate. Correct behaviour |
| *"Crossref: Couldn't be reached just now"* | Timeout or provider error. Retries on next uncached load |
| Nothing at all | The concept has no distinctive search term, so it was not searched |

A confidently irrelevant citation is worse than an empty panel. See
[`RESEARCH_PIPELINE.md`](RESEARCH_PIPELINE.md).

### Videos say "Search — we haven't vetted specific videos"

`YOUTUBE_API_KEY` is not set. This is the honest fallback: a real search the
student can run, rather than a model-invented video title that 404s.

### No GitHub section appears

Expected for every subject except Computer Science and Engineering. The
provider declines other subjects rather than returning weak results.

If it is missing for CS: unauthenticated GitHub search allows **10 requests per
minute**. Set `GITHUB_TOKEN` (no scopes needed) to raise it to 30.

### Stale resources after adding a provider

Bundles cache for 14 days. The cache key is versioned (`resources:v2:`) —
bump it if you change the bundle shape again.

---

## Spotify

### The music card doesn't appear at all

`SPOTIFY_CLIENT_ID` and `SPOTIFY_REDIRECT_URI` must both be set.
`SPOTIFY_CLIENT_SECRET` is optional — the flow uses PKCE. A partial config is
treated as unconfigured, deliberately: a Connect button that lands on a Spotify
error page is worse than no button.

### `INVALID_CLIENT: Invalid redirect URI`

The redirect URI must match the Spotify dashboard **character for character**,
including protocol, host, port and path.

```
http://127.0.0.1:3000/spotify/callback
```

`/api/spotify/callback` also still works, if that is what your dashboard has.

Spotify no longer accepts `localhost` for new apps — use `127.0.0.1`.

### Redirected back with `?spotify=state_mismatch`

Either the `gf_spotify_state` or the `gf_spotify_verifier` cookie expired
(both last 10 minutes) or was not sent. Both are required: `state` proves the
callback belongs to a flow this browser started, and the PKCE `verifier` proves
the code redemption does too.

Start the connection again. If it persists, check that cookies are not being
blocked — and that you are not returning to a *different* host than the one you
started from (`localhost` vs `127.0.0.1` are different cookie origins).

### Connected, but the card says "Press play in Spotify"

Spotify returned 204: nothing is playing on any device. Start playback in the
Spotify app once and the card picks it up within ten seconds.

### The transport controls aren't shown

The account is not Premium. **Spotify requires Premium for every playback
control endpoint** — this is their policy and is not worked around. Showing
what is playing works on any plan.

### "No active Spotify device"

Premium account, but Spotify is not open anywhere. Open Spotify on any device
and press play once; it then becomes the target for the controls.

### A user can't log in to Spotify at all

**A new Spotify app starts in development mode**, limited to a small number of
users who must each be added by email in the Spotify dashboard. Add every
account that will sign in *before* a demo. See
[`INTEGRATIONS.md`](INTEGRATIONS.md#spotify--read-this-before-relying-on-it).

---

## UI

### The tab bar disappears on a tab

Every `href` in `BottomNav`'s `items` must also appear in `TAB_ROUTES` in
`src/app/(main)/layout.tsx`. `tests/navigation.test.ts` guards this in both
directions — run `npm test`.

### The page won't scroll past the fold

The document scrolls, not a container inside it. An `overflow-y-auto` wrapper
takes its height from its content, so `scrollHeight === clientHeight` and
everything past the fold is clipped. A sticky tab bar pins fine over a normally
scrolling page.

---

## Verification

```bash
npm run verify   # lint + typecheck + unit tests + deterministic eval
```

This passes with **no API keys at all**. If `verify` passes but the app
misbehaves, the problem is configuration — start at
[`ENVIRONMENT.md`](ENVIRONMENT.md).

To see which provider served any given call:

```
/dev/observability
```
