import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const analysis = await prisma.analysis.findFirst({
    where: { id: params.id, userId },
    include: {
      gaps: {
        include: {
          concept: true,
          practiceAttempts: true,
          transferAttempts: true,
        },
      },
    },
  });
  if (!analysis) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const existingReport = await prisma.report.findFirst({ where: { analysisId: analysis.id } });
  if (existingReport) {
    return NextResponse.json({
      report: {
        ...existingReport,
        mastered: JSON.parse(existingReport.mastered),
        improved: JSON.parse(existingReport.improved),
        recommendations: JSON.parse(existingReport.recommendations),
      },
    });
  }

  const gapsFound = analysis.gaps.length;
  const gapsRepaired = analysis.gaps.filter((g) => g.status === "repaired" || g.status === "closed").length;
  const gapsTransferred = analysis.gaps.filter((g) => g.status === "closed").length;

  const scorePercent = gapsFound === 0 ? 100 : Math.round((gapsRepaired / gapsFound) * 100);

  const mastered = analysis.gaps.filter((g) => g.status === "closed").map((g) => g.concept.name);
  const improved = analysis.gaps.filter((g) => g.status === "repaired").map((g) => g.concept.name);
  const recommendations = analysis.gaps
    .filter((g) => g.status === "open")
    .map((g) => `Practice ${g.concept.name.toLowerCase()} to close this gap.`);

  const session = await prisma.session.create({
    data: {
      userId,
      analysisId: analysis.id,
      endedAt: new Date(),
      gapsFound,
      gapsRepaired,
      gapsTransferred,
      scorePercent,
    },
  });

  const report = await prisma.report.create({
    data: {
      sessionId: session.id,
      analysisId: analysis.id,
      scorePercent,
      mastered: JSON.stringify(mastered),
      improved: JSON.stringify(improved),
      recommendations: JSON.stringify(recommendations),
    },
  });

  return NextResponse.json({
    report: { ...report, mastered, improved, recommendations },
  });
}
