import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

/**
 * Builds the teach-back question from the student's own divergence.
 *
 * A generic prompt ("explain inverse operations") lets a student recite a
 * definition they never actually got wrong. Naming the two expressions from
 * their own work forces them to account for the specific move they missed.
 */
function teachBackQuestion(params: {
  conceptName: string;
  divergingExpression?: string;
  correctedExpression?: string | null;
  previousExpression?: string;
}): string {
  const { divergingExpression, correctedExpression, previousExpression, conceptName } = params;

  if (previousExpression && correctedExpression) {
    return `Going from "${previousExpression}" you wrote "${divergingExpression}", but it should be "${correctedExpression}". In your own words, why?`;
  }
  if (divergingExpression) {
    return `You wrote "${divergingExpression}". Explain in your own words why that step doesn't hold.`;
  }
  return `In your own words, why does ${conceptName.toLowerCase()} work the way it does?`;
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const gap = await prisma.gap.findFirst({
    where: { id: params.id, analysis: { userId } },
    include: {
      concept: true,
      analysis: { include: { reasoningSteps: { orderBy: { order: "asc" } } } },
      practiceAttempts: { orderBy: { createdAt: "desc" }, take: 5 },
      transferAttempts: { orderBy: { createdAt: "desc" }, take: 5 },
      teachBackAttempts: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!gap) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const steps = gap.analysis.reasoningSteps;
  const divergenceIndex = steps.findIndex((s) => s.isFirstGap);
  const divergence = divergenceIndex >= 0 ? steps[divergenceIndex] : undefined;
  const previous = divergenceIndex > 0 ? steps[divergenceIndex - 1] : undefined;

  const mastery = await prisma.masteryRecord.findUnique({
    where: { userId_conceptId: { userId, conceptId: gap.conceptId } },
  });

  return NextResponse.json({
    gap: {
      id: gap.id,
      classification: gap.classification,
      surfaceError: gap.surfaceError,
      underlyingGap: gap.underlyingGap,
      confidence: gap.confidence,
      status: gap.status,
      createdAt: gap.createdAt,
      concept: { id: gap.concept.id, name: gap.concept.name, slug: gap.concept.slug },
      evidence: safeJson(gap.evidence, []),
      explanation: safeJson(gap.explanationText, null),
      masteryScore: mastery?.masteryScore ?? 0,
      divergence: divergence
        ? {
            order: divergence.order,
            expression: divergence.expression,
            correctedExpression: divergence.correctedExpression,
            verificationNote: divergence.verificationNote,
          }
        : null,
      previousExpression: previous?.expression ?? null,
      teachBackQuestion: teachBackQuestion({
        conceptName: gap.concept.name,
        divergingExpression: divergence?.expression,
        correctedExpression: divergence?.correctedExpression,
        previousExpression: previous?.expression,
      }),
      attempts: {
        practice: gap.practiceAttempts.length,
        practiceCorrect: gap.practiceAttempts.filter((a) => a.isCorrect).length,
        transfer: gap.transferAttempts.length,
        transferCorrect: gap.transferAttempts.filter((a) => a.isCorrect).length,
        teachBackBest: gap.teachBackAttempts.reduce((best, a) => Math.max(best, a.rubricScore), 0),
      },
    },
  });
}
