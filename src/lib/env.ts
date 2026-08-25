// Server-only environment access. Never import this from a "use client" component.
// GEMINI_API_KEY must never be sent to the browser.

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  GEMINI_VISION_MODEL: process.env.GEMINI_VISION_MODEL ?? "gemini-1.5-flash",
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-secret-change-me",
  DEMO_MODE_DEFAULT: process.env.DEMO_MODE_DEFAULT === "true",
  AI_CACHE_TTL_HOURS: Number(process.env.AI_CACHE_TTL_HOURS ?? 168), // 7 days
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES ?? 2),
} as const;

export function hasGeminiKey(): boolean {
  return env.GEMINI_API_KEY.length > 0;
}
