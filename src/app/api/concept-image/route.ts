import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { generateConceptImage } from "@/lib/ai/pipeline/generate-image";

/** Image generation is slower than text, and it is never on the critical path. */
export const maxDuration = 60;

/**
 * The illustration for a topic, fetched separately from the explanation.
 *
 * Loading it on its own request is what keeps it optional: the lesson, the
 * diagram and the quiz are already on screen by the time this resolves, so a
 * slow or unavailable image costs the student nothing. A 204 means "no picture
 * this time" — the caller simply renders nothing.
 */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  const topic = req.nextUrl.searchParams.get("topic")?.trim();
  const subject = req.nextUrl.searchParams.get("subject")?.trim() || "science";
  if (!topic || topic.length > 120) return new NextResponse(null, { status: 400 });

  const image = await generateConceptImage(topic, subject).catch(() => null);
  if (!image) return new NextResponse(null, { status: 204 });

  const bytes = Buffer.from(image.data, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(bytes.byteLength),
      // A concept's illustration is stable, so let the browser keep it.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
