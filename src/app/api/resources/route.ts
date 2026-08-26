import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getResources } from "@/lib/resources";

/** External providers set the pace here, not us. */
export const maxDuration = 30;

/**
 * Videos and papers for a topic that has no concept record behind it.
 *
 * The slug-based route serves the curated library, where a documented
 * misconception sharpens the query. A student asking about something outside
 * that library deserves the same reading and watching list — the only
 * difference is that the query is built from their topic rather than from a
 * proved diagnosis.
 */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const topic = req.nextUrl.searchParams.get("topic")?.trim();
  const subject = req.nextUrl.searchParams.get("subject")?.trim() || "Science";
  if (!topic || topic.length > 120) {
    return NextResponse.json({ error: "Name a topic." }, { status: 400 });
  }

  const bundle = await getResources({
    conceptName: topic,
    // Cache key only — there is no Concept row with this slug.
    conceptSlug: topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    subject,
  });

  return NextResponse.json(bundle);
}
