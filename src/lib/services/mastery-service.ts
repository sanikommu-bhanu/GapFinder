import { prisma } from "@/lib/db/prisma";
import { computeMasteryUpdate, type MasteryEventType } from "@/lib/ai/pipeline/update-mastery";

export async function applyMasteryEvent(params: {
  userId: string;
  conceptId: string;
  event: MasteryEventType;
  teachBackRubricScore?: number;
  analysisId?: string;
  extraPayload?: Record<string, unknown>;
}) {
  const existing = await prisma.masteryRecord.findUnique({
    where: { userId_conceptId: { userId: params.userId, conceptId: params.conceptId } },
  });
  const currentScore = existing?.masteryScore ?? 0;

  const { newScore, trend } = computeMasteryUpdate({
    currentScore,
    event: params.event,
    teachBackRubricScore: params.teachBackRubricScore,
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
      payload: JSON.stringify({ conceptId: params.conceptId, newScore, trend, ...params.extraPayload }),
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
