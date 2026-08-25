import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { hasGeminiKey } from "@/lib/env";
import { evaluateTeachBack } from "@/lib/ai/pipeline/evaluate-teachback";
import { scoreTeachBackOffline } from "@/lib/ai/fallback/offline-rubric";
import { applyMasteryEvent } from "@/lib/services/mastery-service";

const Body = z.object({
  studentExplanation: z.string().min(1).max(4000),
  inputMode: z.enum(["voice", "text"]).default("text"),
});

/**
 * Scores a student's spoken or typed explanation against the teach-back rubric.
 *
 * Gemini reads it when available. When it isn't, the local rubric scores the
 * same four criteria rather than failing the student for an outage — and the
 * response says which one ran, so the UI can label it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Write a sentence or two first." }, { status: 400 });

  const gap = await prisma.gap.findFirst({
    where: { id: params.id, analysis: { userId } },
    include: { concept: true },
  });
  if (!gap) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let evaluation: {
    rubricScore: number;
    criteriaMet: { criterion: string; met: boolean; note: string }[];
    feedback: string;
    source: "gemini" | "deterministic";
  };

  if (hasGeminiKey()) {
    try {
      const { result } = await evaluateTeachBack({
        conceptName: gap.concept.name,
        underlyingGap: gap.underlyingGap,
        studentExplanation: parsed.data.studentExplanation,
        analysisId: gap.analysisId,
      });
      evaluation = { ...result, source: "gemini" };
    } catch (err) {
      console.warn("[teach-back] falling back to local rubric", err);
      evaluation = {
        ...scoreTeachBackOffline({
          studentExplanation: parsed.data.studentExplanation,
          conceptName: gap.concept.name,
        }),
        source: "deterministic",
      };
    }
  } else {
    evaluation = {
      ...scoreTeachBackOffline({
        studentExplanation: parsed.data.studentExplanation,
        conceptName: gap.concept.name,
      }),
      source: "deterministic",
    };
  }

  const attempt = await prisma.teachBackAttempt.create({
    data: {
      gapId: gap.id,
      studentExplanation: parsed.data.studentExplanation,
      inputMode: parsed.data.inputMode,
      rubricScore: evaluation.rubricScore,
      rubricNotes: JSON.stringify(evaluation.criteriaMet),
    },
  });

  const masteryRecord = await applyMasteryEvent({
    userId,
    conceptId: gap.conceptId,
    event: "teach_back",
    teachBackRubricScore: evaluation.rubricScore,
    analysisId: gap.analysisId,
  });

  return NextResponse.json({
    attempt: { id: attempt.id },
    result: evaluation,
    masteryScore: masteryRecord.masteryScore,
  });
}
