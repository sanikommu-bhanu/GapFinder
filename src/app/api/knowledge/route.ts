import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

const MAX_IDS = 12;

/**
 * Returns the curated knowledge chunks an explanation cited, so the app can
 * show a student exactly what its answer was grounded in. Read-only, and
 * limited to the curated corpus — there is no user data on this path.
 */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (ids.length === 0) return NextResponse.json({ chunks: [] });

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, content: true, kind: true, concept: { select: { name: true } } },
  });

  return NextResponse.json({
    chunks: chunks.map((c) => ({
      id: c.id,
      title: c.title,
      content: c.content,
      kind: c.kind,
      conceptName: c.concept.name,
    })),
  });
}
