import { prisma } from "@/lib/db/prisma";

/**
 * An illustration of the topic a student asked about.
 *
 * This sits deliberately *beside* the computed diagram rather than replacing
 * it. Image models render text as convincing-looking gibberish — a diagram
 * whose arrows are labelled with nonsense is worse than no diagram at all in a
 * tool a student is meant to trust. So the prompt forbids text entirely: the
 * picture carries the subject, and the diagram beside it carries the labels,
 * which are computed or curated and therefore correct.
 *
 * Only Gemini serves images. When it is rate-limited, or the key is absent, or
 * Groq is taking the request instead, this returns null and the explanation
 * renders exactly as it otherwise would.
 */

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** An illustration of a school concept does not change; keep it for a month. */
const CACHE_TTL_HOURS = 24 * 30;

export interface ConceptImage {
  mimeType: string;
  /** Base64 payload, exactly as the model returned it. */
  data: string;
}

function cacheKey(topic: string): string {
  return `concept-image:${IMAGE_MODEL}:${topic.trim().toLowerCase()}`;
}

/**
 * The house style, so a set of these read as one product rather than as a
 * scrapbook. Text is refused four different ways because image models are
 * persistent about adding it.
 */
function buildPrompt(topic: string, subject: string): string {
  return [
    `A clean, flat-vector educational illustration of "${topic}" for a ${subject} textbook.`,
    "Simple shapes, generous white space, soft violet and teal palette on a plain white background.",
    "Calm, modern, friendly — the style of a well-designed school textbook, not a stock photo.",
    "ABSOLUTELY NO TEXT: no words, no letters, no numbers, no labels, no captions, no watermarks,",
    "no arrows carrying writing. The image must be entirely wordless. Show the idea through",
    "shape, colour and arrangement alone.",
  ].join(" ");
}

export async function generateConceptImage(
  topic: string,
  subject: string
): Promise<ConceptImage | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const cached = await readCache(topic);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${IMAGE_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(topic, subject) }] }],
      }),
    });
  } catch {
    // Network trouble is not worth surfacing — the page has a diagram already.
    return null;
  }

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as GeminiResponse | null;
  const part = payload?.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((p) => p.inlineData?.data);

  if (!part?.inlineData?.data) return null;

  const image: ConceptImage = {
    mimeType: part.inlineData.mimeType || "image/png",
    data: part.inlineData.data,
  };

  await writeCache(topic, image);
  return image;
}

async function readCache(topic: string): Promise<ConceptImage | null> {
  try {
    const row = await prisma.aiCallCache.findUnique({ where: { cacheKey: cacheKey(topic) } });
    if (!row || (row.expiresAt && row.expiresAt <= new Date())) return null;
    const parsed = JSON.parse(row.responseJson) as ConceptImage;
    return parsed.data ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(topic: string, image: ConceptImage): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 3600_000);
  await prisma.aiCallCache
    .upsert({
      where: { cacheKey: cacheKey(topic) },
      create: {
        cacheKey: cacheKey(topic),
        stage: "concept-image",
        responseJson: JSON.stringify(image),
        expiresAt,
      },
      update: { responseJson: JSON.stringify(image), expiresAt },
    })
    .catch(() => {
      // Caching is an optimisation. Failing to cache must not lose the image.
    });
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { inlineData?: { mimeType?: string; data?: string } }[];
    };
  }[];
}
