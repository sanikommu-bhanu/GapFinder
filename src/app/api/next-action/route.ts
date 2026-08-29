import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { decideNextBestAction, type ConceptSnapshot } from "@/lib/learner/next-best-action";
import { deriveIndependence, type Evidence } from "@/lib/learner/evidence";
import type { InterventionAction } from "@/lib/learner/intervention";

/**
 * "What should I do next, and why?"
 *
 * This route does no thinking. It assembles a snapshot from rows the student's
 * own work created, hands it to the decision engine, and returns what came
 * back. No model is called — which is why it is fast, free, and returns the
 * same answer twice for the same data.
 *
 * The reasoning is returned alongside the decision so the UI can show its
 * working rather than asking to be trusted.
 */

/** Mastery at or above this counts a prerequisite as met. Matches the roadmap. */
const PREREQ_THRESHOLD = 60;

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const subject = req.nextUrl.searchParams.get("subject");

  const [concepts, prerequisites, masteryRecords, gaps] = await Promise.all([
    prisma.concept.findMany({
      where: subject ? { subject } : undefined,
      select: { id: true, slug: true, name: true, subject: true },
    }),
    prisma.conceptRelationship.findMany({
      where: { relationType: "prerequisite" },
      select: { fromId: true, toId: true },
    }),
    prisma.masteryRecord.findMany({ where: { userId }, select: { conceptId: true, masteryScore: true } }),
    // Every gap this student has ever had, with the attempts made against it.
    // Scoped through `analysis.userId` so one student can never read another's.
    prisma.gap.findMany({
      where: { analysis: { userId } },
      select: {
        id: true,
        conceptId: true,
        status: true,
        misconceptionCode: true,
        classification: true,
        createdAt: true,
        practiceAttempts: {
          select: { problemId: true, isCorrect: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        transferAttempts: {
          select: { problemId: true, isCorrect: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const conceptIds = new Set(concepts.map((c) => c.id));
  const masteryByConcept = new Map(masteryRecords.map((m) => [m.conceptId, m.masteryScore]));

  // How many times each misconception code has been diagnosed, per concept.
  const recurrenceByConcept = new Map<string, number>();
  const dominantCodeCount = new Map<string, Map<string, number>>();
  for (const g of gaps) {
    if (!g.misconceptionCode || g.misconceptionCode === "UNCLASSIFIED") continue;
    const perConcept = dominantCodeCount.get(g.conceptId) ?? new Map<string, number>();
    perConcept.set(g.misconceptionCode, (perConcept.get(g.misconceptionCode) ?? 0) + 1);
    dominantCodeCount.set(g.conceptId, perConcept);
  }
  for (const [conceptId, counts] of dominantCodeCount) {
    recurrenceByConcept.set(conceptId, Math.max(...counts.values()));
  }

  const gapsByConcept = new Map<string, typeof gaps>();
  for (const g of gaps) {
    gapsByConcept.set(g.conceptId, [...(gapsByConcept.get(g.conceptId) ?? []), g]);
  }

  const snapshots: ConceptSnapshot[] = concepts.map((c) => {
    const conceptGaps = gapsByConcept.get(c.id) ?? [];
    const evidence: Evidence[] = [];
    const recentAttempts: { isCorrect: boolean }[] = [];

    for (const g of conceptGaps) {
      const seenPractice = new Set<string>();
      for (const a of g.practiceAttempts) {
        const first = !seenPractice.has(a.problemId);
        seenPractice.add(a.problemId);
        evidence.push({
          kind: "answer_result",
          source: "practice",
          concept: c.slug,
          isPositive: a.isCorrect,
          independence: deriveIndependence({ attemptIndex: first ? 1 : 2 }),
          difficulty: "repair",
          observedAt: a.createdAt,
          note: a.isCorrect ? "Practice problem solved." : "Practice problem not solved.",
        });
        recentAttempts.push({ isCorrect: a.isCorrect });
      }

      const seenTransfer = new Set<string>();
      for (const a of g.transferAttempts) {
        const first = !seenTransfer.has(a.problemId);
        seenTransfer.add(a.problemId);
        evidence.push({
          kind: "transfer",
          source: "transfer",
          concept: c.slug,
          isPositive: a.isCorrect,
          independence: deriveIndependence({ attemptIndex: first ? 1 : 2 }),
          difficulty: "transfer",
          observedAt: a.createdAt,
          note: a.isCorrect ? "Transfer problem solved." : "Transfer problem not solved.",
        });
        recentAttempts.push({ isCorrect: a.isCorrect });
      }
    }

    const openGaps = conceptGaps.filter((g) => g.status === "open");
    const latestGap = conceptGaps[conceptGaps.length - 1];
    const lastAttempt = recentAttempts[recentAttempts.length - 1];

    return {
      conceptId: c.id,
      slug: c.slug,
      name: c.name,
      masteryScore: masteryByConcept.get(c.id) ?? 0,
      prerequisiteIds: prerequisites.filter((p) => p.toId === c.id).map((p) => p.fromId),
      hasOpenGap: openGaps.length > 0,
      recurrenceCount: recurrenceByConcept.get(c.id) ?? 0,
      // An arithmetic slip is a different kind of problem from a conceptual one
      // and gets a different response. Read from the diagnosis, not guessed.
      isArithmeticSlip: Boolean(latestGap?.misconceptionCode?.includes("ARITHMETIC-SLIP")),
      lastAttemptWasCorrect: lastAttempt ? lastAttempt.isCorrect : openGaps.length === 0,
      interventionHistory: interventionHistoryFor(conceptGaps),
      evidence,
      recentAttempts: recentAttempts.slice(-5),
    };
  });

  // A concept is startable when its prerequisites are met, or when the
  // student's own work has already surfaced it. Telling someone the concept
  // their homework just broke on is "not available yet" is both wrong and
  // discouraging, so engagement always unlocks.
  const engaged = new Set(gaps.map((g) => g.conceptId));
  const unlockedConceptIds = snapshots
    .filter(
      (s) =>
        engaged.has(s.conceptId) ||
        s.prerequisiteIds
          .filter((id) => conceptIds.has(id))
          .every((id) => (masteryByConcept.get(id) ?? 0) >= PREREQ_THRESHOLD)
    )
    .map((s) => s.conceptId);

  const decision = decideNextBestAction({ concepts: snapshots, unlockedConceptIds });

  return NextResponse.json({
    action: decision.action,
    reason: decision.reason,
    rule: decision.rule,
    targetConcept: decision.targetConcept,
    difficulty: decision.difficulty,
    confidence: decision.confidence,
    // The "Why this?" payload: the facts the decision was made from.
    evidence: decision.evidence,
  });
}

/**
 * What has already been tried for this concept.
 *
 * Derived from what the student was actually given: a gap that reached the
 * "repaired" state was practised, and an explanation was written when the gap
 * carries explanation text. This avoids adding a table to record something the
 * existing rows already imply.
 */
function interventionHistoryFor(
  conceptGaps: { status: string; practiceAttempts: unknown[]; transferAttempts: unknown[] }[]
): InterventionAction[] {
  const history: InterventionAction[] = [];
  for (const g of conceptGaps) {
    // Every diagnosed gap is explained to the student when it is first shown.
    history.push("concise_explanation");
    if (g.practiceAttempts.length > 0) history.push("targeted_practice");
    if (g.transferAttempts.length > 0) history.push("transfer_problem");
  }
  return history;
}
