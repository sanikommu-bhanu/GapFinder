import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { generateRecommendation } from "@/lib/ai/pipeline/generate-recommendation";

/** Mastery at or above this counts a prerequisite as met. */
const PREREQ_THRESHOLD = 60;
/** Mastery at or above this marks a concept mastered. */
const MASTERED_THRESHOLD = 90;

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Builds the student's roadmap from the concept graph and their own mastery
 * record: a concept unlocks when its prerequisites are met, and is marked
 * mastered on evidence rather than on completion. The next-best step is then
 * recommended against that same evidence.
 */
/** This route calls Gemini; the default serverless ceiling is too low. */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // A roadmap is a path through ONE subject. Rendering all four in a single
  // list put Algebra next to Photosynthesis, which reads as incoherent because
  // it is — they share no prerequisites and no ordering.
  const requestedSubject = req.nextUrl.searchParams.get("subject");

  const [concepts, relationships, confusedEdges, masteryRecords, memory, latestAnalysis, activeRec] =
    await Promise.all([
      prisma.concept.findMany(),
      prisma.conceptRelationship.findMany({ where: { relationType: "prerequisite" } }),
      prisma.conceptRelationship.findMany({ where: { relationType: "commonly-confused-with" } }),
      prisma.masteryRecord.findMany({ where: { userId } }),
      prisma.learningMemory.findUnique({ where: { userId } }),
      prisma.analysis.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
      prisma.recommendation.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  // Concepts the student's own work has already surfaced. These are never
  // locked: telling someone that the concept their homework just broke on is
  // "not available yet" is both wrong and discouraging.
  const engagedConceptIds = new Set(
    (await prisma.gap.findMany({ where: { analysis: { userId } }, select: { conceptId: true } })).map(
      (g) => g.conceptId
    )
  );

  const masteryByConceptId = new Map(masteryRecords.map((m) => [m.conceptId, m]));
  const conceptById = new Map(concepts.map((c) => [c.id, c]));

  // Default to the subject the student has actually been working in, so the
  // roadmap opens on something relevant rather than alphabetically first.
  const subjectsWithWork = await prisma.gap.findMany({
    where: { analysis: { userId } },
    select: { analysis: { select: { subject: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const mostRecentSubject = subjectsWithWork[0]?.analysis.subject ?? null;

  const availableSubjects = Array.from(new Set(concepts.map((c) => c.subject))).sort();
  const activeSubject =
    (requestedSubject && availableSubjects.includes(requestedSubject) ? requestedSubject : null) ??
    (mostRecentSubject && availableSubjects.includes(mostRecentSubject) ? mostRecentSubject : null) ??
    availableSubjects[0] ??
    "Math";

  const subjectConcepts = concepts.filter((c) => c.subject === activeSubject);

  const nodes = subjectConcepts.map((c) => {
    const mastery = masteryByConceptId.get(c.id);
    const score = mastery?.masteryScore ?? 0;
    const prereqIds = relationships.filter((r) => r.toId === c.id).map((r) => r.fromId);
    const prereqsMet = prereqIds.every((pid) => (masteryByConceptId.get(pid)?.masteryScore ?? 0) >= PREREQ_THRESHOLD);
    const engaged = engagedConceptIds.has(c.id);
    const status =
      score >= MASTERED_THRESHOLD ? "mastered" : engaged || prereqsMet ? "active" : "locked";
    return {
      conceptId: c.id,
      slug: c.slug,
      name: c.name,
      masteryScore: score,
      trend: mastery?.trend ?? "stable",
      status,
      prerequisites: prereqIds
        .map((pid) => conceptById.get(pid)?.name)
        .filter((n): n is string => Boolean(n)),
    };
  });

  await prisma.roadmap.upsert({
    where: { userId },
    create: { userId, nodes: JSON.stringify(nodes) },
    update: { nodes: JSON.stringify(nodes) },
  });

  const recurringGapIds = safeJson<{ conceptId: string }[]>(memory?.recurringGaps, []).map((g) => g.conceptId);

  // Only concepts the roadmap shows as startable can be recommended as next.
  const unlockedConceptIds = nodes.filter((n) => n.status !== "locked").map((n) => n.conceptId);

  const recommendation = await generateRecommendation({
    unlockedConceptIds,
    masteryRecords: masteryRecords.map((m) => ({
      conceptId: m.conceptId,
      conceptSlug: conceptById.get(m.conceptId)?.slug ?? "",
      conceptName: conceptById.get(m.conceptId)?.name ?? "",
      masteryScore: m.masteryScore,
    })),
    recurringGapConceptIds: recurringGapIds,
    prerequisiteEdges: relationships.map((r) => ({
      fromSlug: conceptById.get(r.fromId)?.slug ?? "",
      toSlug: conceptById.get(r.toId)?.slug ?? "",
    })),
    commonlyConfusedEdges: confusedEdges.map((r) => ({
      aSlug: conceptById.get(r.fromId)?.slug ?? "",
      bSlug: conceptById.get(r.toId)?.slug ?? "",
    })),
    latestAnalysisId: latestAnalysis?.id,
  });

  // Only record a recommendation when it actually changes. Writing one per page
  // view would fill the table with duplicates and destroy the history it exists
  // to keep.
  if (recommendation && (activeRec?.conceptId !== recommendation.conceptId || activeRec?.reason !== recommendation.reason)) {
    await prisma.$transaction([
      prisma.recommendation.updateMany({ where: { userId, isActive: true }, data: { isActive: false } }),
      prisma.recommendation.create({
        data: {
          userId,
          conceptId: recommendation.conceptId,
          reason: recommendation.reason,
          priority: recommendation.priority,
        },
      }),
    ]);
  }

  const recommendedConcept = recommendation ? conceptById.get(recommendation.conceptId) : null;

  return NextResponse.json({
    activeSubject,
    availableSubjects,
    nodes,
    recommendation: recommendation
      ? { ...recommendation, conceptName: recommendedConcept?.name ?? null, conceptSlug: recommendedConcept?.slug ?? null }
      : null,
  });
}
