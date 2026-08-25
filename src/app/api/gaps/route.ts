import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

// Lists the current user's gaps across all analyses — powers the
// "My Learning Gaps" screen. Supports ?status=open|repaired|closed
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");

  const gaps = await prisma.gap.findMany({
    where: { analysis: { userId }, ...(status ? { status } : {}) },
    include: { concept: true },
    orderBy: { createdAt: "desc" },
  });

  const masteryRecords = await prisma.masteryRecord.findMany({ where: { userId } });
  const masteryByConcept = new Map(masteryRecords.map((m) => [m.conceptId, m.masteryScore]));

  const overallMastery = masteryRecords.length
    ? Math.round(masteryRecords.reduce((sum, m) => sum + m.masteryScore, 0) / masteryRecords.length)
    : 0;

  return NextResponse.json({
    overallMastery,
    gaps: gaps.map((g) => ({
      id: g.id,
      classification: g.classification,
      surfaceError: g.surfaceError,
      underlyingGap: g.underlyingGap,
      status: g.status,
      confidence: g.confidence,
      concept: { id: g.concept.id, name: g.concept.name, slug: g.concept.slug },
      masteryScore: masteryByConcept.get(g.conceptId) ?? 0,
      createdAt: g.createdAt,
    })),
    conceptMastery: masteryRecords.map((m) => ({ conceptId: m.conceptId, score: m.masteryScore, trend: m.trend })),
  });
}
