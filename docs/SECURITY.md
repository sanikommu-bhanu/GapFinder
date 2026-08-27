# Security

What is protected, how, and what the actual boundaries are.

---

## The secret boundary

**No secret ever reaches the browser.** Three mechanisms enforce this, and each
is independently checkable:

### 1. One read point

Every credential is read through `src/lib/env.ts`. The file carries an explicit
"server-only" contract and is never imported from a `"use client"` component.

```bash
# Should return only src/lib/env.ts and the documented middleware exception.
grep -rn "process\.env\." src --include="*.ts" --include="*.tsx" | grep -v NODE_ENV
```

### 2. No public prefix

Next.js only inlines a variable into the client bundle when it is prefixed
`NEXT_PUBLIC_`. GapFinder defines none.

```bash
grep -rn "NEXT_PUBLIC" src    # expect: no matches
```

### 3. No client component reaches the server layer

```bash
# Expect no output: no "use client" file imports env or the database.
grep -rln '"use client"' src | xargs grep -l "lib/env\|db/prisma"
```

### What is never done

Secrets are never placed in `localStorage`, `sessionStorage`, React state, a
non-httpOnly cookie, a URL, an API response body, a log line, or the repository.
`.env` is gitignored and untracked.

---

## Authentication

Sessions are stateless JWTs (`jose`, HS256, 30-day expiry) in an **httpOnly**
cookie named `gf_session`.

| Property | Value | Why |
| --- | --- | --- |
| `httpOnly` | `true` | JavaScript cannot read the token — an XSS cannot exfiltrate a session |
| `secure` | `true` in production | Never sent over plaintext HTTP |
| `sameSite` | `lax` | Blocks cross-site POST while allowing normal navigation |
| `path` | `/` | — |

Passwords are hashed with `bcryptjs`. Plaintext passwords are never stored or
logged.

### Two layers, not one

`src/middleware.ts` is the outer gate. It **verifies the signature** with
`jose` — not merely checking that some cookie exists — and redirects
unauthenticated page requests to `/splash`, returning 401 for `/api/*`.

Every API route independently calls `getSessionUserId()`. Middleware is defence
in depth, not the only check, so a routing misconfiguration cannot expose data.

> `middleware.ts` must live in `src/`. With a `src` directory, Next.js does not
> look for middleware at the repository root, and a root copy is **silently
> ignored** — which is exactly how every protected page once became publicly
> reachable.

### Ownership is scoped in the query

Authorisation is not a separate check that could be forgotten. Ownership is
part of the `where` clause:

```ts
prisma.gap.findFirst({ where: { id: params.id, analysis: { userId } } })
```

A gap belonging to another user returns 404, not 403 — the existence of another
student's record is not disclosed.

---

## Spotify OAuth

The flow is **Authorization Code with PKCE** (RFC 7636). Two independent
secrets are minted at login, both into httpOnly cookies with a 10-minute life,
and both spent on the first callback whatever its outcome.

### `state` — CSRF on the callback

16 random bytes in `gf_spotify_state`. The callback rejects any request whose
`state` is missing or does not match.

Without this, a crafted callback URL could link an attacker's Spotify account
to a logged-in student's session.

### `code_verifier` — code interception

A 64-byte random value in `gf_spotify_verifier`; only its SHA-256 hash is sent
to Spotify at authorize time. Spotify recomputes the hash at redemption, so an
authorization code leaked from a redirect chain, a proxy log or browser history
is useless to anyone who does not hold the verifier.

Because GapFinder has a server, PKCE is additive here rather than a replacement
for client authentication: with `SPOTIFY_CLIENT_SECRET` set, the token call
*also* authenticates over Basic auth.

### Callback exposure

Both `/spotify/callback` and `/api/spotify/callback` are exempt from the
middleware session gate — deliberately, so the handler runs, spends its
single-use cookies and reports an outcome instead of bouncing to `/splash` and
leaving them behind. This exposes nothing: the handler links a Spotify account
*to a session*, and with no session it does exactly nothing.

### Token storage

| Token | Where | Reaches browser |
| --- | --- | --- |
| Client secret | `env.ts`, server memory only | **Never** |
| Refresh token | `SpotifyAccount.refreshToken` | **Never** |
| Access token | `SpotifyAccount.accessToken` | **Never** |
| PKCE verifier | httpOnly cookie, 10 min, single use | **Never** (httpOnly) |

The current implementation controls playback **server-side** via
`/api/spotify/control`, so no Spotify token is exposed to the client at all.
The browser sends an action name; the server attaches the credential.

### Revocation

When a refresh is rejected, the `SpotifyAccount` row is **deleted**, not
blanked. A revoked token and a disconnect are indistinguishable, and both mean
"offer to reconnect". There is no half-linked state to reason about.

`show_dialog=true` is set on the authorize URL so a shared machine cannot
silently link the previous person's account.

---

## Input validation

Every mutating API route validates its body with `zod` before use. Route
parameters are always scoped by `userId`.

Uploaded images are compressed through `sharp` server-side, which re-encodes
the pixel data and discards any embedded metadata or malformed structure. Work
is stored in the database rather than on disk — a serverless host has no
persistent writable filesystem, and a database write cannot become a path
traversal.

---

## What the AI is not trusted with

A security property as much as a correctness one:

- Model output is **always** re-validated against a `zod` schema. "The API
  promised" is not the same as "the data is right".
- No model output is ever `eval`'d, executed, or used to build a query.
- No model is asked for a URL, DOI, title or author. Every link shown to a
  student comes from a provider API. A fabricated citation is the one error a
  student would repeat in their own coursework.
- No model decides whether a student is wrong. That is computed by
  `verify-and-find-divergence.ts` and `solution-audit.ts`.

---

## Known limits

Stated plainly rather than omitted:

- **No rate limiting on auth endpoints.** `/api/auth/login` will accept
  unlimited attempts. A production deployment should add per-IP throttling.
- **No CSRF token on same-site mutating routes.** `sameSite=lax` blocks the
  cross-site form POST case, which is the practical attack; a defence-in-depth
  token is not implemented.
- **No Content-Security-Policy header** is set. Spotify album artwork is loaded
  from `i.scdn.co`, which a CSP would need to allow.
- **No automated dependency scanning** is wired into CI.
- **Sessions cannot be revoked server-side.** A stateless JWT is valid until it
  expires; logout clears the cookie but does not invalidate the token.

---

## Reporting

If you find a vulnerability, please open a private security advisory rather
than a public issue.
