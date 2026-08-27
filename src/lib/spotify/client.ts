import { prisma } from "@/lib/db/prisma";
import { env, hasSpotifyConfig } from "@/lib/env";

/**
 * The Spotify server layer.
 *
 * Everything that touches a credential happens in this file, on the server.
 * The client secret is used only in the two token calls below; the refresh
 * token never leaves the database; and the access token is handed to the
 * browser only where the Web Playback SDK genuinely requires it — the SDK
 * cannot work any other way, and that token is short-lived and scope-limited
 * by design.
 *
 * The other rule here is that Spotify being absent is a normal state, not an
 * error. No key configured, no account linked, an expired refresh, a free-tier
 * account, a revoked scope — each returns a shaped result the UI can render,
 * because Focus Mode must work perfectly with none of this available.
 */

const AUTH_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";
const TIMEOUT_MS = 6000;

/**
 * The narrowest scope set that supports the card.
 *
 * Reading what's playing needs the two read scopes; the transport controls need
 * modify-playback-state. `user-read-private` is what tells us whether the
 * account is Premium, which is what decides whether we render controls that
 * would otherwise 403. Nothing here grants access to a library or playlists.
 */
export const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
  "streaming",
].join(" ");

export interface SpotifyStatus {
  /** No client id/secret on the server — the card hides entirely. */
  configured: boolean;
  connected: boolean;
  /** Premium gates playback control; Spotify enforces this, not us. */
  isPremium: boolean;
  displayName: string | null;
}

export function authorizeUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    state,
    // PKCE: Spotify will only redeem the returned code for whoever can present
    // the matching verifier. See lib/spotify/pkce.ts.
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    // Always re-prompt: a student demoing on someone else's machine must not
    // be silently logged into the previous person's account.
    show_dialog: "true",
  });
  return `${AUTH_BASE}/authorize?${params}`;
}

function basicAuth(): string {
  return Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
}

/** True when a client secret is configured — i.e. a confidential client. */
export function isConfidentialClient(): boolean {
  return env.SPOTIFY_CLIENT_SECRET.length > 0;
}

async function tokenRequest(body: URLSearchParams): Promise<{
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
} | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // A confidential client authenticates with the secret over Basic auth and
    // never puts it in the body. A public client (PKCE only, no secret
    // configured) identifies itself with client_id instead — the verifier is
    // what proves the request is genuine.
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (isConfidentialClient()) {
      headers.Authorization = `Basic ${basicAuth()}`;
    } else {
      body.set("client_id", env.SPOTIFY_CLIENT_ID);
    }

    const res = await fetch(`${AUTH_BASE}/api/token`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body,
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, never>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Exchanges the one-time authorization code for a token pair.
 *
 * `codeVerifier` is the PKCE secret this browser generated before consent.
 * Spotify recomputes its hash and refuses the exchange unless it matches the
 * challenge sent at authorize time.
 */
export async function exchangeCode(
  code: string,
  codeVerifier: string
): Promise<boolean | string> {
  const token = await tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
      code_verifier: codeVerifier,
    })
  );
  if (!token?.access_token || !token.refresh_token) return false;
  return JSON.stringify(token);
}

/** Persists a freshly issued token pair against the user. */
export async function linkAccount(
  userId: string,
  token: { access_token: string; refresh_token: string; expires_in?: number; scope?: string }
): Promise<void> {
  const profile = await fetchProfile(token.access_token);
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000);

  await prisma.spotifyAccount.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope ?? SPOTIFY_SCOPES,
      product: profile?.product ?? "unknown",
      displayName: profile?.display_name ?? null,
    },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope ?? SPOTIFY_SCOPES,
      product: profile?.product ?? "unknown",
      displayName: profile?.display_name ?? null,
    },
  });
}

async function fetchProfile(
  accessToken: string
): Promise<{ product?: string; display_name?: string } | null> {
  const res = await spotifyFetch("/me", accessToken);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as { product?: string; display_name?: string };
  } catch {
    return null;
  }
}

/**
 * Returns a usable access token, refreshing it first if it is within a minute
 * of expiry. Returns null when the account is gone or the refresh was rejected
 * — a revoked token is indistinguishable from a disconnect, and both mean the
 * card should offer to reconnect rather than throw.
 */
export async function getAccessToken(userId: string): Promise<string | null> {
  if (!hasSpotifyConfig()) return null;

  const account = await prisma.spotifyAccount.findUnique({ where: { userId } }).catch(() => null);
  if (!account) return null;

  // A one-minute skew: a token that expires mid-request is a token that failed.
  if (account.expiresAt.getTime() - Date.now() > 60_000) return account.accessToken;

  const refreshed = await tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: account.refreshToken })
  );

  if (!refreshed?.access_token) {
    // The refresh token is dead. Remove the row so the UI shows "Connect"
    // instead of failing every call against credentials that will never work.
    await prisma.spotifyAccount.delete({ where: { userId } }).catch(() => {});
    return null;
  }

  await prisma.spotifyAccount
    .update({
      where: { userId },
      data: {
        accessToken: refreshed.access_token,
        // Spotify returns a new refresh token only sometimes; keep the old one
        // when it doesn't, or the next refresh has nothing to present.
        refreshToken: refreshed.refresh_token ?? account.refreshToken,
        expiresAt: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000),
      },
    })
    .catch(() => {});

  return refreshed.access_token;
}

export async function spotifyFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getStatus(userId: string): Promise<SpotifyStatus> {
  if (!hasSpotifyConfig()) {
    return { configured: false, connected: false, isPremium: false, displayName: null };
  }
  const account = await prisma.spotifyAccount.findUnique({ where: { userId } }).catch(() => null);
  return {
    configured: true,
    connected: Boolean(account),
    isPremium: account?.product === "premium",
    displayName: account?.displayName ?? null,
  };
}

export async function disconnect(userId: string): Promise<void> {
  await prisma.spotifyAccount.delete({ where: { userId } }).catch(() => {});
}
