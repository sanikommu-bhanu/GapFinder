import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { findExamCandidates, buildQuestionsForConcept, QUESTIONS_PER_CONCEPT } from "@/lib/exam/build-exam";
import { judgeConcept, examScore, type QuestionOutcome } from "@/lib/exam/verdict";
import { checkStudentWork } from "@/lib/verification/check-student-work";
import { detectMisconception } from "@/lib/diagnosis/detect-misconception";
import { verifyAndFindDivergence } from "@/lib/ai/pipeline/verify-and-find-divergence";
import { applyMasteryEvent } from "@/lib/services/mastery-service";

/** Question generation may call a model per question. */
export const maxDuration = 60;

const StartBody = z.object({ action: z.literal("start") });

const AnswerBody = z.object({
  action: z.literal("answer"),
  examId: z.string(),
  questionId: z.string(),
  studentAnswer: z.string().min(1).max(4000),
  timeSpentSeconds: z.number().int().min(0).max(7200).optional(),
});

const FinishBody = z.object({ action: z.literal("finish"), examId: z.string() });

const Body = z.union([StartBody, AnswerBody, FinishBody]);

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Unrecognised request." }, { status: 400 });

  if (parsed.data.action === "start") return startExam(userId);
  if (parsed.data.action === "answer") return recordAnswer(userId, parsed.data);
  return finishExam(userId, parsed.data.examId);
}

/**
 * Builds an exam from concepts the student has actually repaired. A concept
 * they've never worked on has nothing to verify, so it isn't examined.
 */
async function startExam(userId: string) {
  const candidates = await findExamCandidates(userId);
  if (candidates.length === 0) {
    return NextResponse.json(
      {
        error:
          "Exam Mode checks whether a repair held. Fix a gap in practice first, then come back and prove it without help.",
      },
      { status: 409 }
    );
  }

  const drafts = (
    await Promise.all(
      candidates.map((candidate) =>
        buildQuestionsForConcept({ userId, candidate, count: QUESTIONS_PER_CONCEPT })
      )
    )
  ).flat();

  if (drafts.length === 0) {
    return NextResponse.json(
      { error: "We couldn't build verified questions right now. Please try again shortly." },
      { status: 503 }
    );
  }

  const exam = await prisma.examSession.create({
    data: {
      userId,
      status: "in_progress",
      questions: {
        create: drafts.map((d, i) => ({
          conceptId: d.conceptId,
          order: i + 1,
          prompt: d.prompt,
          correctAnswer: d.correctAnswer,
          source: d.source,
        })),
      },
    },
    include: { questions: { include: { concept: true }, orderBy: { order: "asc" } } },
  });

  return NextResponse.json({
    examId: exam.id,
    conceptsUnderTest: candidates.map((c) => ({ name: c.conceptName, reason: c.reason })),
    // correctAnswer is deliberately absent — this is an exam.
    questions: exam.questions.map((q) => ({
      id: q.id,
      order: q.order,
      prompt: q.prompt,
      conceptName: q.concept.name,
    })),
  });
}

/**
 * Grades one answer and stores it. No feedback is returned — that is what
 * makes it an exam rather than practice.
 */
async function recordAnswer(
  userId: string,
  body: { examId: string; questionId: string; studentAnswer: string; timeSpentSeconds?: number }
) {
  const question = await prisma.examQuestion.findFirst({
    where: { id: body.questionId, exam: { id: body.examId, userId, status: "in_progress" } },
  });
  if (!question) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const check = checkStudentWork(body.studentAnswer, question.correctAnswer, question.prompt);

  // Identify the misconception the same way the diagnosis does, so an old
  // habit resurfacing here is recognisable as the same habit.
  let misconceptionCode: string | null = null;
  if (!check.isCorrect) {
    const lines = [question.prompt, ...body.studentAnswer.split(/\n+/).map((l) => l.trim()).filter(Boolean)];
    const verified = verifyAndFindDivergence(
      lines.map((expression, i) => ({ order: i + 1, statement: expression, expression }))
    );
    const divergence = verified.find((v) => v.isFirstGap);
    if (divergence) {
      const previous = verified[verified.findIndex((v) => v.isFirstGap) - 1];
      misconceptionCode =
        detectMisconception({
          divergence,
          previousExpression: previous?.expression ?? question.prompt,
          subject: "Math",
        })?.misconception.code ?? null;
    }
  }

  await prisma.examQuestion.update({
    where: { id: question.id },
    data: {
      studentAnswer: body.studentAnswer,
      isCorrect: check.isCorrect,
      reasoningValid: check.firstErrorLine === null,
      firstErrorLine: check.firstErrorLine,
      misconceptionCode,
      timeSpentSeconds: body.timeSpentSeconds ?? null,
      answeredAt: new Date(),
    },
  });

  // Recorded, not reported. The student sees results only at the end.
  return NextResponse.json({ recorded: true });
}

async function finishExam(userId: string, examId: string) {
  const exam = await prisma.examSession.findFirst({
    where: { id: examId, userId },
    include: { questions: { include: { concept: true }, orderBy: { order: "asc" } } },
  });
  if (!exam) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // What this student was already prone to, so a relapse is recognisable.
  const priorGaps = await prisma.gap.findMany({
    where: { analysis: { userId }, misconceptionCode: { not: null } },
    select: { misconceptionCode: true },
  });
  const priorCodes = Array.from(new Set(priorGaps.map((g) => g.misconceptionCode!)));

  const byConcept = new Map<string, { name: string; outcomes: QuestionOutcome[] }>();
  for (const q of exam.questions) {
    if (q.answeredAt === null) continue;
    const entry = byConcept.get(q.conceptId) ?? { name: q.concept.name, outcomes: [] };
    entry.outcomes.push({
      conceptId: q.conceptId,
      isCorrect: Boolean(q.isCorrect),
      reasoningValid: Boolean(q.reasoningValid),
      misconceptionCode: q.misconceptionCode,
    });
    byConcept.set(q.conceptId, entry);
  }

  const results = Array.from(byConcept.entries()).map(([conceptId, entry]) =>
    judgeConcept({
      conceptId,
      conceptName: entry.name,
      outcomes: entry.outcomes,
      priorMisconceptionCodes: priorCodes,
    })
  );

  await prisma.examSession.update({
    where: { id: exam.id },
    data: { status: "complete", completedAt: new Date(), verdicts: JSON.stringify(results) },
  });

  // Exam evidence moves mastery, weighted like a transfer: succeeding without
  // help is stronger evidence than succeeding with it.
  for (const result of results) {
    await applyMasteryEvent({
      userId,
      conceptId: result.conceptId,
      event: result.verdict === "mastered" ? "transfer_correct" : "practice_incorrect",
      extraPayload: { source: "exam", verdict: result.verdict },
    }).catch(() => {});
  }

  return NextResponse.json({ score: examScore(results), results });
}
