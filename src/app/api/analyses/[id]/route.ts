import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { getMisconception } from "@/lib/diagnosis/misconceptions";

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
        // The documented misconception behind the error, plus how it was
        // arrived at, so the diagnosis can be checked rather than trusted.
        misconception: g.misconceptionCode
          ? {
              code: g.misconceptionCode,
              basis: g.misconceptionBasis,
              evidence: g.misconceptionEvidence,
              ...describeMisconception(g.misconceptionCode),
            }
          : null,
      })),
    },
  });
}

/**
 * Gap JSON columns are written by the pipeline, but a row seeded or migrated by
 * hand could hold anything. Returning a fallback keeps one malformed row from
 * turning the whole analysis screen into a 500.
 */
/** Expands a stored catalogue code into the text the UI shows. */
function describeMisconception(code: string) {
  const m = getMisconception(code);
  return {
    name: m.name,
    studentRule: m.studentRule,
    whyItFails: m.whyItFails,
    socraticPrompt: m.socraticPrompt,
  };
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
