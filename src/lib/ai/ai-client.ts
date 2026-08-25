import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { computeCacheKey } from "./cache-key";
import { geminiProvider } from "./providers/gemini";
import { groqProvider } from "./providers/groq";
import { AiUnavailableError, isWorthFailingOver, type AiProvider } from "./providers/types";

export { AiUnavailableError } from "./providers/types";

/**
 * The model call: cache, then provider cascade, then the caller's own
 * deterministic fallback.
 *
 *   cache hit  →  Gemini  →  Groq  →  (caller falls back to local logic)
 *
 * The cascade exists because a free-tier rate limit is a certainty, not an
 * edge case, and hitting one shouldn't cost the student the quality of their
 * explanation. Gemini stays first — its vision is the strongest here and every
 * prompt is tuned to it — and Groq picks up whatever it drops.
 *
 * Every attempt is logged with the provider that made it, so the observability
 * view shows exactly who answered and why the first choice didn't.
 */

const PROVIDERS: AiProvider[] = [geminiProvider, groqProvider];

interface StructuredCallOptions<T extends z.ZodTypeAny> {
  stage: string;
  schema: T;
  systemInstruction: string;
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  useVisionModel?: boolean;
  cacheTtlHours?: number;
  skipCache?: boolean;
  /** Links this call back to the analysis it served, for the trace view. */
  analysisId?: string;
  /** Which RAG chunks fed this prompt — makes retrieval traceable per call. */
  retrievedChunkIds?: string[];
}

export interface StructuredResult<T> {
  data: T;
  cached: boolean;
  /** Which provider actually answered, or "cache". */
  provider: string;
}

export async function generateStructured<T extends z.ZodTypeAny>(
  opts: StructuredCallOptions<T>
): Promise<StructuredResult<z.infer<T>>> {
  const hasImage = Boolean(opts.imageBase64);
  const cacheKey = computeCacheKey(opts.stage, {
    prompt: opts.prompt,
    system: opts.systemInstruction,
    hasImage,
    imageBase64: opts.imageBase64 ? hashOnly(opts.imageBase64) : undefined,
  });
  const startedAt = Date.now();

  if (!opts.skipCache) {
    const cached = await prisma.aiCallCache.findUnique({ where: { cacheKey } }).catch(() => null);
    if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
      const parsed = opts.schema.safeParse(safeParse(cached.responseJson));
      if (parsed.success) {
        await logUsage({
          stage: opts.stage,
          model: "cache",
          provider: "cache",
          succeeded: true,
          cached: true,
          analysisId: opts.analysisId,
          retrievedChunkIds: opts.retrievedChunkIds,
          latencyMs: Date.now() - startedAt,
        });
        return { data: parsed.data, cached: true, provider: "cache" };
      }
    }
  }

  const attempts = PROVIDERS.filter((p) => p.isConfigured() && p.canHandle({ hasImage }));

  if (attempts.length === 0) {
    throw new AiUnavailableError(
      "no_key",
      hasImage
        ? "No provider is configured that can read images."
        : "No AI provider is configured."
    );
  }

  let lastError: unknown;

  for (const provider of attempts) {
    const attemptStarted = Date.now();
    try {
      const data = await withRetries(provider, opts, hasImage);

      await prisma.aiCallCache
        .upsert({
          where: { cacheKey },
          create: {
            cacheKey,
            stage: opts.stage,
            responseJson: JSON.stringify(data),
            expiresAt: new Date(Date.now() + (opts.cacheTtlHours ?? env.AI_CACHE_TTL_HOURS) * 3600_000),
          },
          update: {
            responseJson: JSON.stringify(data),
            expiresAt: new Date(Date.now() + (opts.cacheTtlHours ?? env.AI_CACHE_TTL_HOURS) * 3600_000),
          },
        })
        .catch(() => {
          // Caching is an optimisation; a failure here must not fail the call.
        });

      await logUsage({
        stage: opts.stage,
        model: provider.modelFor({ hasImage }),
        provider: provider.name,
        succeeded: true,
        cached: false,
        analysisId: opts.analysisId,
        retrievedChunkIds: opts.retrievedChunkIds,
        latencyMs: Date.now() - attemptStarted,
      });

      return { data, cached: false, provider: provider.name };
    } catch (error) {
      lastError = error;
      await logUsage({
        stage: opts.stage,
        model: provider.modelFor({ hasImage }),
        provider: provider.name,
        succeeded: false,
        cached: false,
        errorText: String(error),
        analysisId: opts.analysisId,
        retrievedChunkIds: opts.retrievedChunkIds,
        latencyMs: Date.now() - attemptStarted,
      });

      if (!isWorthFailingOver(error)) continue;
      // Otherwise fall through to the next provider.
    }
  }

  if (lastError instanceof AiUnavailableError) throw lastError;
  throw new AiUnavailableError("network", `All providers failed: ${String(lastError)}`);
}

/**
 * Retries within a provider only for transient trouble. A rate limit is not
 * transient on a free tier, so it fails straight through to the next provider
 * instead of waiting out a window that won't move.
 */
async function withRetries<T extends z.ZodTypeAny>(
  provider: AiProvider,
  opts: StructuredCallOptions<T>,
  hasImage: boolean
): Promise<z.infer<T>> {
  const maxAttempts = env.AI_MAX_RETRIES + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await provider.generate({
        schema: opts.schema,
        systemInstruction: opts.systemInstruction,
        prompt: opts.prompt,
        imageBase64: opts.imageBase64,
        imageMimeType: opts.imageMimeType,
        useVisionModel: opts.useVisionModel ?? hasImage,
      });
    } catch (error) {
      lastError = error;
      const reason = error instanceof AiUnavailableError ? error.reason : "network";
      if (reason === "quota" || reason === "no_key" || reason === "unsupported") throw error;
      if (attempt < maxAttempts) await sleep(300 * attempt);
    }
  }
  throw lastError;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hashOnly(base64: string): string {
  // Avoid persisting full image bytes in the cache key; length plus prefix is
  // enough to dedupe without bloating storage.
  return `${base64.length}:${base64.slice(0, 32)}`;
}

async function logUsage(entry: {
  stage: string;
  model: string;
  provider: string;
  succeeded: boolean;
  cached: boolean;
  errorText?: string;
  analysisId?: string;
  retrievedChunkIds?: string[];
  latencyMs?: number;
}) {
  try {
    await prisma.aiUsageLog.create({
      data: {
        stage: entry.stage,
        // Recorded as "provider:model" so the trace shows who served the call.
        model: `${entry.provider}:${entry.model}`,
        succeeded: entry.succeeded,
        cached: entry.cached,
        errorText: entry.errorText,
        analysisId: entry.analysisId,
        latencyMs: entry.latencyMs,
        retrievedChunkIds: entry.retrievedChunkIds ? JSON.stringify(entry.retrievedChunkIds) : undefined,
      },
    });
  } catch {
    // Usage logging must never break the request path.
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when at least one provider can serve a text call. */
export function hasAnyProvider(): boolean {
  return PROVIDERS.some((p) => p.isConfigured() && p.canHandle({ hasImage: false }));
}

/** True when at least one provider can read images. */
export function hasVisionProvider(): boolean {
  return PROVIDERS.some((p) => p.isConfigured() && p.canHandle({ hasImage: true }));
}
