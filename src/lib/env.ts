// Server-only environment access. Never import this from a "use client" component.
// GEMINI_API_KEY must never be sent to the browser.

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

export const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  // 1.5-flash is retired; 2.5-flash is the current free-tier multimodal model.
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  GEMINI_VISION_MODEL: process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  SESSION_SECRET: sessionSecret(),
  AI_CACHE_TTL_HOURS: Number(process.env.AI_CACHE_TTL_HOURS ?? 168), // 7 days
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES ?? 2),
} as const;

export function hasGeminiKey(): boolean {
  return env.GEMINI_API_KEY.length > 0;
}
