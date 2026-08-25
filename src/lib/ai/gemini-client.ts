import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { z } from "zod";
import { toGeminiResponseSchema } from "@/lib/ai/schemas/to-gemini-schema";
import { env, hasGeminiKey } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { computeCacheKey } from "./cache-key";

export class AiUnavailableError extends Error {
  constructor(public reason: "no_key" | "quota" | "network" | "invalid_response", message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

let client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!hasGeminiKey()) {
    throw new AiUnavailableError("no_key", "GEMINI_API_KEY is not configured on the server.");
  }
  if (!client) client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client;
}

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
  /** Links this call back to the analysis it served, for the AI Observability view. */
  analysisId?: string;
  /** Which RAG knowledge-chunk ids (if any) were fed into this prompt — makes retrieval traceable per call. */
  retrievedChunkIds?: string[];
}

/**
 * Calls Gemini with a JSON response schema derived from a zod schema, validates
 * the result against that same zod schema, and transparently caches by
 * (stage, normalized input) so repeated identical requests never hit the API
 * twice. This is the primary free-tier conservation mechanism alongside
 * deterministic local verification (see /lib/verification).
 */
export async function generateStructured<T extends z.ZodTypeAny>(
  opts: StructuredCallOptions<T>
): Promise<{ data: z.infer<T>; cached: boolean }> {
  const cacheInput = {
    prompt: opts.prompt,
    system: opts.systemInstruction,
    hasImage: Boolean(opts.imageBase64),
    imageBase64: opts.imageBase64 ? hashOnly(opts.imageBase64) : undefined,
  };
  const cacheKey = computeCacheKey(opts.stage, cacheInput);
  const startedAt = Date.now();

  if (!opts.skipCache) {
    const cached = await prisma.aiCallCache.findUnique({ where: { cacheKey } });
    if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
      const parsed = opts.schema.safeParse(JSON.parse(cached.responseJson));
      if (parsed.success) {
        await logUsage(opts.stage, true, true, undefined, {
          analysisId: opts.analysisId,
          retrievedChunkIds: opts.retrievedChunkIds,
          latencyMs: Date.now() - startedAt,
        });
        return { data: parsed.data, cached: true };
      }
    }
  }

  const jsonSchema = toGeminiResponseSchema(opts.schema);
  const model = getClient().getGenerativeModel({
    model: opts.useVisionModel ? env.GEMINI_VISION_MODEL : env.GEMINI_MODEL,
    systemInstruction: opts.systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      // The SDK types responseSchema against its own Schema interface; ours is
      // built to Gemini's documented wire format (see to-gemini-schema.ts).
      responseSchema: jsonSchema as never,
      temperature: 0.2,
    },
  });

  const parts: Part[] = [{ text: opts.prompt }];
  if (opts.imageBase64) {
    parts.unshift({
      inlineData: { data: opts.imageBase64, mimeType: opts.imageMimeType ?? "image/jpeg" },
    });
  }

  const maxAttempts = env.AI_MAX_RETRIES + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await model.generateContent({ contents: [{ role: "user", parts }] });
      const text = result.response.text();
      const json = JSON.parse(text);
      const parsed = opts.schema.safeParse(json);
      if (!parsed.success) {
        throw new AiUnavailableError(
          "invalid_response",
          `Gemini response failed schema validation: ${parsed.error.message}`
        );
      }

      await prisma.aiCallCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          stage: opts.stage,
          responseJson: JSON.stringify(parsed.data),
          expiresAt: new Date(Date.now() + (opts.cacheTtlHours ?? env.AI_CACHE_TTL_HOURS) * 3600_000),
        },
        update: {
          responseJson: JSON.stringify(parsed.data),
          expiresAt: new Date(Date.now() + (opts.cacheTtlHours ?? env.AI_CACHE_TTL_HOURS) * 3600_000),
        },
      });
      await logUsage(opts.stage, true, false, undefined, {
        analysisId: opts.analysisId,
        retrievedChunkIds: opts.retrievedChunkIds,
        latencyMs: Date.now() - startedAt,
      });
      return { data: parsed.data, cached: false };
    } catch (err) {
      lastError = err;
      const isQuota = isQuotaError(err);
      await logUsage(opts.stage, false, false, String(err), {
        analysisId: opts.analysisId,
        retrievedChunkIds: opts.retrievedChunkIds,
        latencyMs: Date.now() - startedAt,
      });
      if (isQuota) {
        // Do not burn retries against a rate limit — fail fast so callers can
        // fall back to deterministic/demo behavior immediately.
        throw new AiUnavailableError("quota", "Gemini free-tier quota reached.");
      }
      if (attempt < maxAttempts) {
        await sleep(300 * attempt);
        continue;
      }
    }
  }

  if (lastError instanceof AiUnavailableError) throw lastError;
  throw new AiUnavailableError("network", `Gemini call failed after retries: ${String(lastError)}`);
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg);
}

function hashOnly(base64: string): string {
  // Avoid persisting full image bytes in the cache-key input; length+prefix is
  // sufficient for dedup purposes without bloating storage.
  return `${base64.length}:${base64.slice(0, 32)}`;
}

async function logUsage(
  stage: string,
  succeeded: boolean,
  cached: boolean,
  errorText?: string,
  extra?: { analysisId?: string; retrievedChunkIds?: string[]; latencyMs?: number }
) {
  try {
    await prisma.aiUsageLog.create({
      data: {
        stage,
        model: env.GEMINI_MODEL,
        succeeded,
        cached,
        errorText,
        analysisId: extra?.analysisId,
        latencyMs: extra?.latencyMs,
        retrievedChunkIds: extra?.retrievedChunkIds ? JSON.stringify(extra.retrievedChunkIds) : undefined,
      },
    });
  } catch {
    // usage logging must never break the request path
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
