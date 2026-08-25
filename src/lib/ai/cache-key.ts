import { createHash } from "crypto";

/**
 * Deterministic cache key for an AI pipeline call. Identical (stage, input)
 * pairs will hit the AiCallCache table instead of re-calling Gemini, which is
 * the primary mechanism keeping this app inside free-tier request quotas.
 */
export function computeCacheKey(stage: string, input: unknown): string {
  const normalized = JSON.stringify(sortKeysDeep(input));
  const hash = createHash("sha256").update(`${stage}::${normalized}`).digest("hex");
  return `${stage}:${hash}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}
