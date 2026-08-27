import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUserId } from "@/lib/auth/session";
import { exchangeCode, linkAccount } from "@/lib/spotify/client";

/**
 * The Spotify OAuth callback, shared by both routes that expose it.
 *
 * `/spotify/callback` is the canonical redirect URI — it is what Spotify is
 * configured with. `/api/spotify/callback` predates it and still works, so an
 * existing dashboard configuration is not broken by the move. One
 * implementation serves both, because two copies of a security-sensitive
 * handshake is how one of them quietly stops matching the other.
 *
 * Every exit is a redirect to /focus with a short outcome code. A student who
 * came from a music card should land back on it with the card explaining what
 * happened — never on a blank page, a raw JSON error, or a stack trace.
 */
const OUTCOMES = [
  "connected",
  "denied",
  "state_mismatch",
  "exchange_failed",
  "unauthenticated",
  "misconfigured",
] as const;

export type CallbackOutcome = (typeof OUTCOMES)[number];

function back(req: NextRequest, outcome: CallbackOutcome): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/focus";
  url.search = `?spotify=${outcome}`;
  const res = NextResponse.redirect(url);
  // Both single-use secrets are spent the moment the callback runs, whatever
  // the result. Leaving either behind would let a failed attempt be replayed.
  res.cookies.delete("gf_spotify_state");
  res.cookies.delete("gf_spotify_verifier");
  return res;
}

export async function handleSpotifyCallback(req: NextRequest): Promise<NextResponse> {
  // The session is what the Spotify account gets linked to. If it expired
  // during the consent screen there is nobody to link, so say so rather than
  // failing obscurely.
  const userId = await getSessionUserId();
  if (!userId) return back(req, "unauthenticated");

  const params = req.nextUrl.searchParams;

  // The student pressed "Cancel" on Spotify's consent screen. Not an error,
  // and not something to apologise for — Focus Mode works without Spotify.
  if (params.get("error")) return back(req, "denied");

  const code = params.get("code");
  const state = params.get("state");

  const jar = cookies();
  const expectedState = jar.get("gf_spotify_state")?.value;
  const verifier = jar.get("gf_spotify_verifier")?.value;

  // A missing or mismatched state means this callback did not come from a flow
  // this browser started. Refuse it rather than link the account.
  if (!code || !state || !expectedState || state !== expectedState) {
    return back(req, "state_mismatch");
  }

  // No verifier means the cookie expired or was never set — the PKCE exchange
  // cannot succeed, so fail here rather than sending Spotify a request it will
  // reject anyway.
  if (!verifier) return back(req, "state_mismatch");

  const raw = await exchangeCode(code, verifier);
  if (typeof raw !== "string") return back(req, "exchange_failed");

  try {
    await linkAccount(
      userId,
      JSON.parse(raw) as {
        access_token: string;
        refresh_token: string;
        expires_in?: number;
        scope?: string;
      }
    );
  } catch {
    // Includes the case where the database is unreachable: the tokens were
    // valid but could not be stored, which is indistinguishable to the student
    // from the exchange failing, and has the same remedy — try again.
    return back(req, "exchange_failed");
  }

  return back(req, "connected");
}
