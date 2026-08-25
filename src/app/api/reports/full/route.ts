import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

/**
 * The learning report, computed entirely from persisted evidence.
 *
 * Nothing here is estimated or filled in for presentation: every count comes
 * from rows the student's own actions created. An empty account reports zeroes
 * rather than a plausible-looking dashboard.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [masteryRecords, latestRecommendation, analysisCount, gaps, teachBacks] = await Promise.all([
    prisma.masteryRecord.findMany({
      where: { userId },
      include: { concept: true },
      orderBy: { masteryScore: "desc" },
    }),
    prisma.recommendation.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.analysis.count({ where: { userId, status: "complete" } }),
    prisma.gap.findMany({
      where: { analysis: { userId } },
      select: { status: true, concept: { select: { name: true } } },
    }),
    prisma.teachBackAttempt.findMany({
      where: { gap: { analysis: { userId } } },
      select: { rubricScore: true },
    }),
  ]);

  const mastered = masteryRecords.filter((m) => m.masteryScore >= 90).map((m) => m.concept.name);
  const improved = masteryRecords.filter((m) => m.trend === "up").map((m) => m.concept.name);

  let recommendationConceptName: string | null = null;
  if (latestRecommendation) {
    const concept = await prisma.concept.findUnique({ where: { id: latestRecommendation.conceptId } });
    recommendationConceptName = concept?.name ?? null;
  }

  return NextResponse.json({
    mastery: masteryRecords.map((m) => ({
      conceptName: m.concept.name,
      score: m.masteryScore,
      trend: m.trend,
    })),
    mastered,
    improved,
    recommendation: latestRecommendation
      ? { conceptName: recommendationConceptName, reason: latestRecommendation.reason }
      : null,
    totals: {
      analyses: analysisCount,
      gapsFound: gaps.length,
      // "repaired" means practice was passed; "closed" additionally means the
      // transfer problem was passed. Closed gaps count as repaired too.
      gapsRepaired: gaps.filter((g) => g.status === "repaired" || g.status === "closed").length,
      gapsTransferred: gaps.filter((g) => g.status === "closed").length,
      teachBacks: teachBacks.length,
      bestTeachBack: teachBacks.reduce((best, t) => Math.max(best, t.rubricScore), 0),
    },
  });
}
