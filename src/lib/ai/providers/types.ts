import type { z } from "zod";

/**
 * A model provider.
 *
 * The app talks to providers through this interface so the calling code never
 * knows or cares which one answered. That matters for one specific reason: the
 * free Gemini tier runs out, and when it does the product should keep its
 * explanation quality by moving to another provider rather than dropping
 * straight to the deterministic fallback.
 */

export type AiFailureReason = "no_key" | "quota" | "network" | "invalid_response" | "unsupported";

export class AiUnavailableError extends Error {
  constructor(
    public reason: AiFailureReason,
    message: string,
    /** Which provider produced this, for the observability trail. */
    public provider?: string
  ) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export interface GenerateRequest<T extends z.ZodTypeAny> {
  schema: T;
  systemInstruction: string;
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  /** Hints that the stronger vision model should be used, where one exists. */
  useVisionModel?: boolean;
}

export interface AiProvider {
  /** Stable identifier written to the usage log. */
  readonly name: string;
  /** False when no key is configured — the router skips it silently. */
  isConfigured(): boolean;
  /** Whether this provider can accept an image at all. */
  canHandle(request: { hasImage: boolean }): boolean;
  /** The model id that would serve this request, for logging. */
  modelFor(request: { hasImage: boolean }): string;
  generate<T extends z.ZodTypeAny>(request: GenerateRequest<T>): Promise<z.infer<T>>;
}

/**
 * Failures worth trying another provider for.
 *
 * A quota or network failure is about the provider, so another one may well
 * succeed. An invalid response means the model answered but produced something
 * that failed schema validation — retrying elsewhere is reasonable, since a
 * different model may format it correctly.
 */
export function isWorthFailingOver(error: unknown): boolean {
  if (!(error instanceof AiUnavailableError)) return true;
  return error.reason !== "no_key";
}
