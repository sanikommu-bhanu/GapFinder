import { createHash, randomBytes } from "crypto";

/**
 * PKCE (RFC 7636) for the Spotify authorization-code flow.
 *
 * PKCE binds the authorization code to the browser that started the flow. The
 * client sends a hash of a secret it generated (`code_challenge`) when it asks
 * for consent, and the original secret (`code_verifier`) when it redeems the
 * code. Spotify only issues tokens if they match, so a code intercepted in
 * transit — from a redirect chain, a proxy log, or browser history — cannot be
 * redeemed by anyone else.
 *
 * GapFinder is a confidential client: it has a server and can hold a secret.
 * PKCE is therefore defence in depth rather than a substitute for one, and both
 * are used together when a client secret is configured. When it isn't, PKCE
 * alone is sufficient and the flow runs as a public client — which is why the
 * integration no longer requires a secret at all.
 *
 * The verifier never reaches client-side JavaScript. It is stored in an
 * httpOnly cookie for the ninety seconds or so that a consent screen takes.
 */

/** RFC 7636 requires 43–128 characters from the unreserved set. */
export function createVerifier(): string {
  // 64 random bytes → 86 base64url characters, comfortably inside the range.
  return base64Url(randomBytes(64));
}

export function challengeFor(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

/**
 * base64url: standard base64 with the URL-unsafe characters swapped and the
 * padding removed, per RFC 4648 §5. Spotify rejects a challenge that still
 * carries "+", "/" or "=".
 */
function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
