import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { selectDifficulty } from "@/lib/ai/pipeline/select-intervention";
import { generatePracticeProblem } from "@/lib/ai/pipeline/generate-practice";
import { AiUnavailableError } from "@/lib/ai/gemini-client";

const Body = z.object({ mode: z.enum(["repair", "transfer"]).default("repair") });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const mode = parsed.success ? parsed.data.mode : "repair";

  const gap = await prisma.gap.findFirst({ where: { id: params.id, analysis: { userId } }, include: { concept: true } });
  if (!gap) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const mastery = await prisma.masteryRecord.findUnique({
    where: { userId_conceptId: { userId, conceptId: gap.conceptId } },
  });
  const priorAttempts = await prisma.practiceAttempt.findMany({
    where: { gap: { conceptId: gap.conceptId, analysis: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { isCorrect: true },
  });

  const difficulty = selectDifficulty({
    currentMasteryScore: mastery?.masteryScore ?? 0,
    recentAttempts: priorAttempts,
    isFirstEncounter: priorAttempts.length === 0,
  });

  try {
    const { result } = await generatePracticeProblem({
      conceptName: gap.concept.name,
      conceptDescription: gap.concept.description,
      difficulty: mode === "transfer" ? "transfer" : difficulty,
      mode,
      analysisId: gap.analysisId,
    });

    const problem = await prisma.practiceProblem.create({
      data: {
        conceptId: gap.conceptId,
        difficulty: result.difficulty,
        prompt: result.prompt,
        correctAnswer: result.correctAnswer,
      },
    });

    return NextResponse.json({ problem });
  } catch (err) {
    const reason =
      err instanceof AiUnavailableError && err.reason === "quota"
        ? "Gemini's free-tier limit was reached generating this problem. Try again shortly."
        : "Couldn't generate a practice problem right now.";
    return NextResponse.json({ error: reason }, { status: 503 });
  }
}
