import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { evaluateTeachBack } from "@/lib/ai/pipeline/evaluate-teachback";
import { applyMasteryEvent } from "@/lib/services/mastery-service";
import { AiUnavailableError } from "@/lib/ai/gemini-client";

const Body = z.object({
  studentExplanation: z.string().min(1),
  inputMode: z.enum(["voice", "text"]).default("text"),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const gap = await prisma.gap.findFirst({ where: { id: params.id, analysis: { userId } }, include: { concept: true } });
  if (!gap) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const { result } = await evaluateTeachBack({
      conceptName: gap.concept.name,
      underlyingGap: gap.underlyingGap,
      studentExplanation: parsed.data.studentExplanation,
      analysisId: gap.analysisId,
    });

    const attempt = await prisma.teachBackAttempt.create({
      data: {
        gapId: gap.id,
        studentExplanation: parsed.data.studentExplanation,
        inputMode: parsed.data.inputMode,
        rubricScore: result.rubricScore,
        rubricNotes: JSON.stringify(result.criteriaMet),
      },
    });

    const masteryRecord = await applyMasteryEvent({
      userId,
      conceptId: gap.conceptId,
      event: "teach_back",
      teachBackRubricScore: result.rubricScore,
      analysisId: gap.analysisId,
    });

    return NextResponse.json({ attempt, result, masteryScore: masteryRecord.masteryScore });
  } catch (err) {
    const reason =
      err instanceof AiUnavailableError && err.reason === "quota"
        ? "Gemini's free-tier limit was reached evaluating this. Try again shortly."
        : "Couldn't evaluate your explanation right now.";
    return NextResponse.json({ error: reason }, { status: 503 });
  }
}
