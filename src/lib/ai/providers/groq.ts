import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AiUnavailableError, type AiProvider, type GenerateRequest } from "./types";

/**
 * Groq — the fallback provider.
 *
 * Two reasons it earns the slot. Its free tier is separate from Google's, so a
 * Gemini rate limit doesn't stop the product working; and its inference is fast
 * enough that failing over costs the student almost nothing in latency.
 *
 * It speaks the OpenAI chat-completions shape, which supports JSON-schema
 * structured output directly — no equivalent of the Gemini schema sanitiser is
 * needed, though the schema is still re-validated with zod afterwards because
 * "the API promised" is not the same as "the data is right".
 *
 * Model ids move faster than this file will, so they're environment variables
 * with current defaults rather than hardcoded.
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 30_000;

function apiKey(): string {
  return process.env.GROQ_API_KEY ?? "";
}

function textModel(): string {
  return process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
}

/**
 * There is no default here on purpose.
 *
 * Groq's catalogue rotates, and at the time of writing the text models it
 * serves are not multimodal. Defaulting to one of them would mean sending a
 * photograph to a model that cannot see it — a silent failure dressed up as a
 * fallback. Set GROQ_VISION_MODEL explicitly if your key can reach a vision
 * model, and vision stays off until you do.
 */
function visionModel(): string | null {
  return process.env.GROQ_VISION_MODEL || null;
}

/**
 * Vision fallback is opt-in. Reading handwritten maths is the one stage where
 * model quality visibly changes the answer, so silently swapping in a weaker
 * reader would degrade the diagnosis without saying so.
 */
function visionFallbackEnabled(): boolean {
  return process.env.GROQ_ALLOW_VISION === "true" && visionModel() !== null;
}

export const groqProvider: AiProvider = {
  name: "groq",

  isConfigured: () => apiKey().length > 10,

  canHandle: ({ hasImage }) => (hasImage ? visionFallbackEnabled() : true),

  modelFor: ({ hasImage }) => (hasImage ? visionModel() ?? textModel() : textModel()),

  async generate<T extends z.ZodTypeAny>(request: GenerateRequest<T>): Promise<z.infer<T>> {
    if (!apiKey()) {
      throw new AiUnavailableError("no_key", "GROQ_API_KEY is not configured.", "groq");
    }

    const hasImage = Boolean(request.imageBase64);
    if (hasImage && !visionFallbackEnabled()) {
      throw new AiUnavailableError(
        "unsupported",
        visionModel() === null
          ? "No Groq vision model is configured (set GROQ_VISION_MODEL to one your key can reach)."
          : "Groq vision fallback is not enabled (set GROQ_ALLOW_VISION=true).",
        "groq"
      );
    }

    // OpenAI-style schemas require additionalProperties:false and every
    // property listed as required for strict mode; zod-to-json-schema already
    // emits the first, and our schemas have no optional fields.
    const jsonSchema = zodToJsonSchema(request.schema, {
      target: "openApi3",
      $refStrategy: "none",
    });

    const userContent = hasImage
      ? [
          { type: "text", text: request.prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${request.imageMimeType ?? "image/jpeg"};base64,${request.imageBase64}`,
            },
          },
        ]
      : request.prompt;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: hasImage ? visionModel() : textModel(),
          temperature: 0.2,
          messages: [
            { role: "system", content: request.systemInstruction },
            { role: "user", content: userContent },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "result", strict: true, schema: jsonSchema },
          },
        }),
      });
    } catch (error) {
      throw new AiUnavailableError("network", `Groq call failed: ${String(error)}`, "groq");
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      throw new AiUnavailableError("quota", "Groq rate limit reached.", "groq");
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // A retired or misspelled model id is a configuration problem, not a
      // transient one — say so rather than reporting a generic network error.
      const reason = /model|decommission|not found/i.test(detail) ? "unsupported" : "network";
      throw new AiUnavailableError(reason, `Groq returned ${response.status}: ${detail.slice(0, 200)}`, "groq");
    }

    let content: string | undefined;
    try {
      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      content = json.choices?.[0]?.message?.content;
    } catch {
      throw new AiUnavailableError("invalid_response", "Groq returned malformed JSON.", "groq");
    }

    if (!content) {
      throw new AiUnavailableError("invalid_response", "Groq returned an empty response.", "groq");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new AiUnavailableError("invalid_response", "Groq content was not valid JSON.", "groq");
    }

    const parsed = request.schema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new AiUnavailableError(
        "invalid_response",
        `Groq response failed schema validation: ${parsed.error.message}`,
        "groq"
      );
    }
    return parsed.data;
  },
};
