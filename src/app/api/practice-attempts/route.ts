import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { validateAnswer } from "@/lib/ai/pipeline/validate-answer";
import { applyMasteryEvent } from "@/lib/services/mastery-service";
import { evaluatePrediction } from "@/lib/services/misconception-history";

const Body = z.object({
  gapId: z.string(),
  problemId: z.string(),
  studentSteps: z.string().min(1).max(4000),
  /** The misconception code we told the student we were watching for. */
  predictedCode: z.string().max(64).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [gap, problem] = await Promise.all([
    prisma.gap.findFirst({ where: { id: parsed.data.gapId, analysis: { userId } } }),
    prisma.practiceProblem.findUnique({ where: { id: parsed.data.problemId } }),
  ]);
  if (!gap || !problem) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const validation = await validateAnswer({
    studentAnswer: parsed.data.studentSteps,
    canonicalAnswer: problem.correctAnswer,
    problemPrompt: problem.prompt,
    analysisId: gap.analysisId,
  });

  const attempt = await prisma.practiceAttempt.create({
    data: {
      gapId: gap.id,
      problemId: problem.id,
      studentSteps: parsed.data.studentSteps,
      isCorrect: validation.isCorrect,
      verifiedBy: validation.verifiedBy,
      feedback: validation.feedback,
    },
  });

  await applyMasteryEvent({
    userId,
    conceptId: gap.conceptId,
    event: validation.isCorrect ? "practice_correct" : "practice_incorrect",
    analysisId: gap.analysisId,
  });

  if (validation.isCorrect && gap.status === "open") {
    await prisma.gap.update({ where: { id: gap.id }, data: { status: "repaired" } });
    await prisma.learningEvent.create({
      data: { userId, analysisId: gap.analysisId, type: "gap_repaired", payload: JSON.stringify({ gapId: gap.id }) },
    });
  }

  // Check the claim we made before they started. A prediction that fails is
  // the strongest evidence this product can produce that something changed —
  // but only because it was stated in advance.
  const prediction = evaluatePrediction({
    predictedCode: parsed.data.predictedCode ?? null,
    // The gap being practised is the one we predicted a repeat of, so a wrong
    // answer here counts as that same misconception recurring.
    actualCode: validation.isCorrect ? null : (gap.misconceptionCode ?? null),
    wasCorrect: validation.isCorrect,
  });

  return NextResponse.json({ attempt, validation, prediction });
}
