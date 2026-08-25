import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [masteryRecords, sessions, latestRecommendation] = await Promise.all([
    prisma.masteryRecord.findMany({ where: { userId }, include: { concept: true }, orderBy: { masteryScore: "desc" } }),
    prisma.session.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.recommendation.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" }, include: { roadmap: false } }),
  ]);

  const mastered = masteryRecords.filter((m) => m.masteryScore >= 90).map((m) => m.concept.name);
  const improved = masteryRecords.filter((m) => m.trend === "up").map((m) => m.concept.name);

  let recommendationConceptName: string | null = null;
  if (latestRecommendation) {
    const c = await prisma.concept.findUnique({ where: { id: latestRecommendation.conceptId } });
    recommendationConceptName = c?.name ?? null;
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
    recentSessions: sessions.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      scorePercent: s.scorePercent,
      gapsFound: s.gapsFound,
      gapsRepaired: s.gapsRepaired,
      gapsTransferred: s.gapsTransferred,
    })),
  });
}
