import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { generateRecommendation } from "@/lib/ai/pipeline/generate-recommendation";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [concepts, relationships, confusedEdges, masteryRecords, memory, latestAnalysis] = await Promise.all([
    prisma.concept.findMany(),
    prisma.conceptRelationship.findMany({ where: { relationType: "prerequisite" } }),
    prisma.conceptRelationship.findMany({ where: { relationType: "commonly-confused-with" } }),
    prisma.masteryRecord.findMany({ where: { userId } }),
    prisma.learningMemory.findUnique({ where: { userId } }),
    prisma.analysis.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);

  const masteryByConceptId = new Map(masteryRecords.map((m) => [m.conceptId, m]));
  const conceptById = new Map(concepts.map((c) => [c.id, c]));

  const nodes = concepts.map((c) => {
    const mastery = masteryByConceptId.get(c.id);
    const prereqIds = relationships.filter((r) => r.toId === c.id).map((r) => r.fromId);
    const prereqsMet = prereqIds.every((pid) => (masteryByConceptId.get(pid)?.masteryScore ?? 0) >= 60);
    const status = mastery && mastery.masteryScore >= 90 ? "mastered" : prereqsMet ? "active" : "locked";
    return {
      conceptId: c.id,
      slug: c.slug,
      name: c.name,
      masteryScore: mastery?.masteryScore ?? 0,
      status,
    };
  });

  await prisma.roadmap.upsert({
    where: { userId },
    create: { userId, nodes: JSON.stringify(nodes) },
    update: { nodes: JSON.stringify(nodes) },
  });

  const recurringGapIds = memory
    ? (JSON.parse(memory.recurringGaps) as { conceptId: string }[]).map((g) => g.conceptId)
    : [];

  const recommendation = await generateRecommendation({
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

  if (recommendation) {
    await prisma.recommendation.create({
      data: {
        userId,
        conceptId: recommendation.conceptId,
        reason: recommendation.reason,
        priority: recommendation.priority,
      },
    });
  }

  return NextResponse.json({ nodes, recommendation });
}
