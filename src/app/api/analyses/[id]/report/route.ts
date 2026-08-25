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

  const gapsFound = analysis.gaps.length;
  const gapsRepaired = analysis.gaps.filter((g) => g.status === "repaired" || g.status === "closed").length;
  const gapsTransferred = analysis.gaps.filter((g) => g.status === "closed").length;

  const scorePercent = gapsFound === 0 ? 100 : Math.round((gapsRepaired / gapsFound) * 100);

  const mastered = analysis.gaps.filter((g) => g.status === "closed").map((g) => g.concept.name);
  const improved = analysis.gaps.filter((g) => g.status === "repaired").map((g) => g.concept.name);
  const recommendations = analysis.gaps.map((g) =>
    g.status === "open"
      ? `Practice ${g.concept.name.toLowerCase()} — this gap is still open.`
      : g.status === "repaired"
        ? `Try the transfer challenge for ${g.concept.name.toLowerCase()} to prove it stuck.`
        : `Keep ${g.concept.name.toLowerCase()} warm — revisit it in a few days.`
  );

  // Recomputed on every read and upserted, rather than frozen on first view.
  // A student who comes back after passing the transfer challenge must see the
  // updated result, not the snapshot from before they did the work.
  const session = await prisma.session.upsert({
    where: { analysisId: analysis.id },
    create: {
      userId,
      analysisId: analysis.id,
      endedAt: new Date(),
      gapsFound,
      gapsRepaired,
      gapsTransferred,
      scorePercent,
    },
    update: { endedAt: new Date(), gapsFound, gapsRepaired, gapsTransferred, scorePercent },
  });

  const payload = {
    scorePercent,
    mastered: JSON.stringify(mastered),
    improved: JSON.stringify(improved),
    recommendations: JSON.stringify(recommendations),
  };

  const report = await prisma.report.upsert({
    where: { analysisId: analysis.id },
    create: { sessionId: session.id, analysisId: analysis.id, ...payload },
    update: payload,
  });

  return NextResponse.json({
    report: {
      ...report,
      mastered,
      improved,
      recommendations,
      gapsFound,
      gapsRepaired,
      gapsTransferred,
    },
  });
}
