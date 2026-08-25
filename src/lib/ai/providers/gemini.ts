import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { z } from "zod";
import { env, hasGeminiKey } from "@/lib/env";
import { toGeminiResponseSchema } from "@/lib/ai/schemas/to-gemini-schema";
import { AiUnavailableError, type AiProvider, type GenerateRequest } from "./types";

/**
 * Google Gemini — the primary provider.
 *
 * It stays primary because its vision handling on handwritten maths is the
 * strongest of the free options, and every prompt in this codebase was tuned
 * against it.
 */

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!hasGeminiKey()) {
    throw new AiUnavailableError("no_key", "GEMINI_API_KEY is not configured.", "gemini");
  }
  if (!client) client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client;
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(message);
}

export const geminiProvider: AiProvider = {
  name: "gemini",

  isConfigured: () => hasGeminiKey(),

  canHandle: () => true,

  modelFor: ({ hasImage }) => (hasImage ? env.GEMINI_VISION_MODEL : env.GEMINI_MODEL),

  async generate<T extends z.ZodTypeAny>(request: GenerateRequest<T>): Promise<z.infer<T>> {
    const model = getClient().getGenerativeModel({
      model: request.useVisionModel ? env.GEMINI_VISION_MODEL : env.GEMINI_MODEL,
      systemInstruction: request.systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        // Built to Gemini's documented wire format; the SDK types its own.
        responseSchema: toGeminiResponseSchema(request.schema) as never,
        temperature: 0.2,
      },
    });

    const parts: Part[] = [{ text: request.prompt }];
    if (request.imageBase64) {
      parts.unshift({
        inlineData: { data: request.imageBase64, mimeType: request.imageMimeType ?? "image/jpeg" },
      });
    }

    let text: string;
    try {
      const result = await model.generateContent({ contents: [{ role: "user", parts }] });
      text = result.response.text();
    } catch (error) {
      if (isQuotaError(error)) {
        // Fail fast rather than burning retries against a rate limit — the
        // router has somewhere else to go.
        throw new AiUnavailableError("quota", "Gemini rate limit reached.", "gemini");
      }
      throw new AiUnavailableError("network", `Gemini call failed: ${String(error)}`, "gemini");
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiUnavailableError("invalid_response", "Gemini returned malformed JSON.", "gemini");
    }

    const parsed = request.schema.safeParse(json);
    if (!parsed.success) {
      throw new AiUnavailableError(
        "invalid_response",
        `Gemini response failed schema validation: ${parsed.error.message}`,
        "gemini"
      );
    }
    return parsed.data;
  },
};
