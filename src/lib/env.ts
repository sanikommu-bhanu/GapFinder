// Server-only environment access. Never import this from a "use client" component.
//
// Every secret the product uses is read here and nowhere else. That is the
// point of the file: one place to audit, one place where a key can be spelled,
// and no `process.env.SOMETHING_KEY` scattered through providers where a future
// edit could quietly move it into a client bundle. Nothing exported from here
// may ever be spread into a server-component prop or an API response.

const isProduction = process.env.NODE_ENV === "production";

/**
 * A session secret is what stops anyone from minting their own login cookie.
 * A development fallback is convenient locally and a genuine vulnerability in
 * production — anyone who has read this file would know the signing key. So the
 * fallback exists only outside production, and a deploy without one fails at
 * boot rather than silently accepting forged sessions.
 */
function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (isProduction) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set it to a long random string (openssl rand -base64 32)."
    );
  }
  return "dev-only-secret-not-for-production";
}

/**
 * Reads are lazy — every entry below is a getter, not a snapshot.
 *
 * An earlier version of this object captured `process.env` once at module
 * load. That is subtly wrong: it freezes configuration at import time, so
 * anything that sets a variable after the first import of this module (a test
 * harness, a script that loads dotenv late) is silently ignored, and the
 * failure looks like "the key isn't working" rather than "the key was read too
 * early". Getters keep the single-choke-point benefit without the trap.
 *
 * SESSION_SECRET is the deliberate exception: it is resolved eagerly below so
 * a production deploy that forgot it fails at boot rather than on the first
 * request that happens to need a session.
 */
export const env = {
  get GEMINI_API_KEY() {
    return process.env.GEMINI_API_KEY ?? "";
  },
  // 1.5-flash is retired; 2.5-flash is the current free-tier multimodal model.
  get GEMINI_MODEL() {
    return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  },
  get GEMINI_VISION_MODEL() {
    return process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash";
  },
  get GEMINI_IMAGE_MODEL() {
    return process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  },

  get GROQ_API_KEY() {
    return process.env.GROQ_API_KEY ?? "";
  },
  get GROQ_MODEL() {
    return process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  },
  // No default on purpose — see providers/groq.ts. Vision must be opted into.
  get GROQ_VISION_MODEL() {
    return process.env.GROQ_VISION_MODEL ?? "";
  },
  get GROQ_ALLOW_VISION() {
    return process.env.GROQ_ALLOW_VISION === "true";
  },

  get YOUTUBE_API_KEY() {
    return process.env.YOUTUBE_API_KEY ?? "";
  },

  /**
   * OpenAlex is keyless. The mailto is not a credential — it is the polite-pool
   * identifier OpenAlex asks callers to send, and it raises the rate limit.
   */
  get OPENALEX_MAILTO() {
    return process.env.OPENALEX_MAILTO ?? "";
  },

  /** A GitHub token only raises the search rate limit; discovery works without one. */
  get GITHUB_TOKEN() {
    return process.env.GITHUB_TOKEN ?? "";
  },

  /**
   * Spotify. The client secret is used exclusively in the server-side token
   * exchange — it is never sent to the browser, never stored in a cookie, and
   * never returned from an API route. The client id is not a secret (it appears
   * in the authorize URL by design) but is still read here so the whole
   * integration has one home.
   */
  get SPOTIFY_CLIENT_ID() {
    return process.env.SPOTIFY_CLIENT_ID ?? "";
  },
  get SPOTIFY_CLIENT_SECRET() {
    return process.env.SPOTIFY_CLIENT_SECRET ?? "";
  },
  get SPOTIFY_REDIRECT_URI() {
    return process.env.SPOTIFY_REDIRECT_URI ?? "";
  },

  get DATABASE_URL() {
    return process.env.DATABASE_URL ?? "";
  },
  SESSION_SECRET: sessionSecret(),
  get AI_CACHE_TTL_HOURS() {
    return Number(process.env.AI_CACHE_TTL_HOURS ?? 168); // 7 days
  },
  get AI_MAX_RETRIES() {
    return Number(process.env.AI_MAX_RETRIES ?? 2);
  },
} as const;

export function hasGeminiKey(): boolean {
  return env.GEMINI_API_KEY.length > 0;
}

export function hasYouTubeKey(): boolean {
  return env.YOUTUBE_API_KEY.length > 10;
}

/**
 * Spotify needs a client id and a redirect URI. The client secret is optional:
 * the flow uses PKCE, which proves the token request came from the browser
 * that started it without any shared secret at all. With a secret configured
 * the app additionally authenticates as a confidential client — belt and
 * braces — but it is not required to connect.
 *
 * A half-set config is still treated as none: the card would otherwise offer a
 * "Connect" button that lands on a Spotify error page the student can do
 * nothing about.
 */
export function hasSpotifyConfig(): boolean {
  return env.SPOTIFY_CLIENT_ID.length > 0 && env.SPOTIFY_REDIRECT_URI.length > 0;
}
