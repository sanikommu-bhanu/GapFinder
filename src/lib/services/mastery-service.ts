import { prisma } from "@/lib/db/prisma";
import { computeMasteryUpdate, type MasteryEventType } from "@/lib/ai/pipeline/update-mastery";
import type { EvidenceDifficulty, Independence } from "@/lib/learner/evidence";

/**
 * Has this learner ever solved a transfer problem on this concept unaided?
 *
 * "Unaided" is read from rows rather than asked: an attempt is independent when
 * it is the FIRST attempt recorded against that problem. A correct answer on
 * the third go at the same question is a real success, but it is not evidence
 * that the concept transfers cold, and the mastery ceiling depends on that
 * distinction.
 */
async function hasIndependentTransfer(userId: string, conceptId: string): Promise<boolean> {
  const attempts = await prisma.transferAttempt.findMany({
    where: { gap: { conceptId, analysis: { userId } } },
    select: { problemId: true, isCorrect: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const seen = new Set<string>();
  for (const a of attempts) {
    const isFirstOnThisProblem = !seen.has(a.problemId);
    seen.add(a.problemId);
    if (a.isCorrect && isFirstOnThisProblem) return true;
  }
  return false;
}

export async function applyMasteryEvent(params: {
  userId: string;
  conceptId: string;
  event: MasteryEventType;
  teachBackRubricScore?: number;
  analysisId?: string;
  extraPayload?: Record<string, unknown>;
  /** How much help the student had. Omitted callers keep the unscaled behaviour. */
  independence?: Independence;
  /** Difficulty of the task that produced the event. */
  difficulty?: EvidenceDifficulty;
}) {
  const [existing, transferred] = await Promise.all([
    prisma.masteryRecord.findUnique({
      where: { userId_conceptId: { userId: params.userId, conceptId: params.conceptId } },
    }),
    hasIndependentTransfer(params.userId, params.conceptId),
  ]);
  const currentScore = existing?.masteryScore ?? 0;

  const { newScore, trend, cappedPendingTransfer } = computeMasteryUpdate({
    currentScore,
    event: params.event,
    teachBackRubricScore: params.teachBackRubricScore,
    independence: params.independence,
    difficulty: params.difficulty,
    hasIndependentTransfer: transferred,
  });

  const history = existing ? (JSON.parse(existing.history) as { date: string; score: number }[]) : [];
  history.push({ date: new Date().toISOString(), score: newScore });

  const record = await prisma.masteryRecord.upsert({
    where: { userId_conceptId: { userId: params.userId, conceptId: params.conceptId } },
    create: {
      userId: params.userId,
      conceptId: params.conceptId,
      masteryScore: newScore,
      trend,
      history: JSON.stringify(history.slice(-30)),
    },
    update: {
      masteryScore: newScore,
      trend,
      history: JSON.stringify(history.slice(-30)),
    },
  });

  await prisma.learningEvent.create({
    data: {
      userId: params.userId,
      analysisId: params.analysisId,
      type:
        params.event === "gap_found"
          ? "gap_found"
          : params.event.includes("transfer")
            ? "transfer_success"
            : params.event === "teach_back"
              ? "teach_back"
              : "mastery_change",
      payload: JSON.stringify({
        conceptId: params.conceptId,
        newScore,
        trend,
        // Recorded so the score is auditable after the fact: a stalled number
        // should be explainable, not mysterious.
        cappedPendingTransfer,
        independence: params.independence ?? null,
        ...params.extraPayload,
      }),
    },
  });

  await updateLearningMemory(params.userId, params.conceptId, params.event);

  return record;
}

async function updateLearningMemory(userId: string, conceptId: string, event: MasteryEventType) {
  const memory = await prisma.learningMemory.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const recurringGaps = JSON.parse(memory.recurringGaps) as { conceptId: string; count: number; lastSeen: string }[];
  const successfulRepairs = JSON.parse(memory.successfulRepairs) as string[];
  const failedRepairs = JSON.parse(memory.failedRepairs) as string[];
  const transferResults = JSON.parse(memory.transferResults) as { conceptId: string; success: boolean; date: string }[];

  if (event === "gap_found") {
    const idx = recurringGaps.findIndex((g) => g.conceptId === conceptId);
    if (idx >= 0) {
      recurringGaps[idx]!.count += 1;
      recurringGaps[idx]!.lastSeen = new Date().toISOString();
    } else {
      recurringGaps.push({ conceptId, count: 1, lastSeen: new Date().toISOString() });
    }
  }
  if (event === "practice_correct") successfulRepairs.push(conceptId);
  if (event === "practice_incorrect") failedRepairs.push(conceptId);
  if (event === "transfer_correct" || event === "transfer_incorrect") {
    transferResults.push({ conceptId, success: event === "transfer_correct", date: new Date().toISOString() });
  }

  await prisma.learningMemory.update({
    where: { userId },
    data: {
      recurringGaps: JSON.stringify(recurringGaps.slice(-50)),
      successfulRepairs: JSON.stringify(successfulRepairs.slice(-50)),
      failedRepairs: JSON.stringify(failedRepairs.slice(-50)),
      transferResults: JSON.stringify(transferResults.slice(-50)),
    },
  });
}
