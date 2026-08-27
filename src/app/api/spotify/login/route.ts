import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSessionUserId } from "@/lib/auth/session";
import { hasSpotifyConfig } from "@/lib/env";
import { authorizeUrl } from "@/lib/spotify/client";
import { createVerifier, challengeFor } from "@/lib/spotify/pkce";

/**
 * Starts the OAuth handshake — Authorization Code with PKCE.
 *
 * Two secrets are minted here and both go into httpOnly cookies, never into
 * the page:
 *
 *   state     proves the callback belongs to a flow this browser started.
 *             Without it, a crafted callback URL could link an attacker's
 *             Spotify account to a logged-in student's session.
 *
 *   verifier  proves the code redemption comes from this same browser. An
 *             authorization code leaked from a redirect chain, a proxy log or
 *             browser history is useless without it.
 *
 * Both are short-lived: ten minutes is far longer than a consent screen takes
 * and short enough that an abandoned attempt cannot be resumed later.
 */
const TEN_MINUTES = 600;

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!hasSpotifyConfig()) {
    return NextResponse.json({ error: "Spotify is not configured on this server." }, { status: 503 });
  }

  const state = randomBytes(16).toString("hex");
  const verifier = createVerifier();

  const jar = cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TEN_MINUTES,
  };

  jar.set("gf_spotify_state", state, options);
  jar.set("gf_spotify_verifier", verifier, options);

  return NextResponse.redirect(authorizeUrl(state, challengeFor(verifier)));
}
