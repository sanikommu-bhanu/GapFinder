import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

// Internal developer/evaluation view: lists this user's analyses with a
// quick pipeline-health summary (status, confidence, error/latency counts)
// so a broken or slow stage is visible before drilling into one analysis.
// Scoped to the signed-in user's own data — there's no separate admin role
// in this app, so this is "my own pipeline runs", not a global admin panel.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const analyses = await prisma.analysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      gaps: { select: { id: true, classification: true, confidence: true } },
    },
  });

  const analysisIds = analyses.map((a) => a.id);
  const logs = await prisma.aiUsageLog.findMany({
    where: { analysisId: { in: analysisIds } },
  });
  const logsByAnalysis = new Map<string, typeof logs>();
  for (const log of logs) {
    if (!log.analysisId) continue;
    const arr = logsByAnalysis.get(log.analysisId) ?? [];
    arr.push(log);
    logsByAnalysis.set(log.analysisId, arr);
  }

  return NextResponse.json({
    analyses: analyses.map((a) => {
      const callLogs = logsByAnalysis.get(a.id) ?? [];
      const errorCount = callLogs.filter((l) => !l.succeeded).length;
      const avgLatencyMs = callLogs.length
        ? Math.round(callLogs.reduce((sum, l) => sum + (l.latencyMs ?? 0), 0) / callLogs.length)
        : null;
      return {
        id: a.id,
        subject: a.subject,
        status: a.status,
        confidence: a.confidence,
        isDemo: a.isDemo,
        createdAt: a.createdAt,
        gapCount: a.gaps.length,
        callCount: callLogs.length,
        errorCount,
        avgLatencyMs,
      };
    }),
  });
}
