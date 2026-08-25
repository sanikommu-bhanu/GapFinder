import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const analysis = await prisma.analysis.findFirst({
    where: { id: params.id, userId },
    include: {
      uploadedWork: true,
      extractedSteps: { orderBy: { order: "asc" } },
      reasoningSteps: { orderBy: { order: "asc" } },
      gaps: { include: { concept: true } },
    },
  });

  if (!analysis) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    analysis: {
      ...analysis,
      correctedSolution: safeJson<string[]>(analysis.correctedSolution, []),
      gaps: analysis.gaps.map((g) => ({
        ...g,
        evidence: safeJson(g.evidence, []),
        explanation: safeJson(g.explanationText, null),
      })),
    },
  });
}

/**
 * Gap JSON columns are written by the pipeline, but a row seeded or migrated by
 * hand could hold anything. Returning a fallback keeps one malformed row from
 * turning the whole analysis screen into a 500.
 */
function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
