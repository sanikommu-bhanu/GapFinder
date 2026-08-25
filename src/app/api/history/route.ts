import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const analyses = await prisma.analysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { gaps: { include: { concept: true } } },
  });

  return NextResponse.json({
    analyses: analyses.map((a) => ({
      id: a.id,
      subject: a.subject,
      status: a.status,
      isDemo: a.isDemo,
      createdAt: a.createdAt,
      gapCount: a.gaps.length,
      concepts: a.gaps.map((g) => g.concept.name),
    })),
  });
}
