import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Converts a zod schema into the response schema Gemini actually accepts.
 *
 * Gemini's `responseSchema` takes a strict subset of OpenAPI 3.0 and rejects
 * the whole request with a 400 if it sees anything outside it — including
 * `additionalProperties`, which `zodToJsonSchema` emits on every object by
 * default. That single unknown key was enough to make every structured call in
 * the pipeline fail, so this strips the schema down to the keys Gemini
 * documents and inlines any `$ref`s, which it also can't follow.
 */

/** The only keys Gemini's Schema type recognises. */
const ALLOWED_KEYS = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "propertyOrdering",
]);

type JsonSchema = Record<string, unknown>;

function resolveRef(node: JsonSchema, root: JsonSchema): JsonSchema {
  const ref = node.$ref;
  if (typeof ref !== "string" || !ref.startsWith("#/")) return node;
  // Walk the pointer manually: Gemini can't resolve $ref, so it must be inlined.
  const segments = ref.slice(2).split("/");
  let current: unknown = root;
  for (const segment of segments) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[decodeURIComponent(segment)];
    } else {
      return node;
    }
  }
  return current && typeof current === "object" ? (current as JsonSchema) : node;
}

function sanitize(node: unknown, root: JsonSchema, depth = 0): JsonSchema {
  if (!node || typeof node !== "object" || depth > 24) return { type: "string" };

  let source = node as JsonSchema;
  if (source.$ref) source = resolveRef(source, root);

  // zod unions/intersections arrive as anyOf/allOf, which Gemini rejects. The
  // first branch is the closest usable approximation.
  for (const key of ["anyOf", "allOf", "oneOf"] as const) {
    const branches = source[key];
    if (Array.isArray(branches) && branches.length > 0) {
      const nonNull = branches.find(
        (b) => !(b && typeof b === "object" && (b as JsonSchema).type === "null")
      );
      const merged = sanitize(nonNull ?? branches[0], root, depth + 1);
      // `z.string().nullable()` becomes [string, null]; keep the nullability.
      if (branches.some((b) => b && typeof b === "object" && (b as JsonSchema).type === "null")) {
        merged.nullable = true;
      }
      return merged;
    }
  }

  const out: JsonSchema = {};

  for (const [key, value] of Object.entries(source)) {
    if (!ALLOWED_KEYS.has(key)) continue;

    if (key === "properties" && value && typeof value === "object") {
      const props: JsonSchema = {};
      for (const [propName, propSchema] of Object.entries(value as JsonSchema)) {
        props[propName] = sanitize(propSchema, root, depth + 1);
      }
      out.properties = props;
      continue;
    }

    if (key === "items") {
      // Tuple form (`items: [...]`) isn't supported; take the first element.
      out.items = sanitize(Array.isArray(value) ? value[0] : value, root, depth + 1);
      continue;
    }

    if (key === "type" && Array.isArray(value)) {
      const concrete = value.find((t) => t !== "null");
      out.type = concrete ?? "string";
      if (value.includes("null")) out.nullable = true;
      continue;
    }

    out[key] = value;
  }

  if (!out.type) {
    out.type = out.properties ? "object" : out.items ? "array" : "string";
  }

  // Gemini preserves key order from propertyOrdering, which makes responses
  // more stable across calls.
  if (out.type === "object" && out.properties) {
    out.propertyOrdering = Object.keys(out.properties as JsonSchema);
    const required = out.required;
    if (Array.isArray(required)) {
      const known = new Set(Object.keys(out.properties as JsonSchema));
      out.required = required.filter((r) => typeof r === "string" && known.has(r));
    }
  }

  return out;
}

export function toGeminiResponseSchema<T extends z.ZodTypeAny>(schema: T): Record<string, unknown> {
  const raw = zodToJsonSchema(schema, { target: "openApi3", $refStrategy: "none" }) as JsonSchema;
  return sanitize(raw, raw);
}
