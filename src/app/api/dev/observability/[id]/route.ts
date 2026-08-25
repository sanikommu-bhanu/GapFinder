import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

// Full per-analysis debug trace: input -> extraction -> reasoning ->
// divergence -> gap -> retrieval -> generated intervention -> validation ->
// practice/transfer results -> latency/errors for every AI call involved.
// This is the "AI Observability" view from the spec — it reads only
// already-persisted rows, it does not call the model again.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const analysis = await prisma.analysis.findFirst({
    where: { id: params.id, userId },
    include: {
      uploadedWork: true,
      extractedSteps: { orderBy: { order: "asc" } },
      reasoningSteps: { orderBy: { order: "asc" } },
      gaps: { include: { concept: true } },
      learningEvents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!analysis) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const callLogs = await prisma.aiUsageLog.findMany({
    where: { analysisId: params.id },
    orderBy: { createdAt: "asc" },
  });

  const gapIds = analysis.gaps.map((g) => g.id);
  const [practiceAttempts, transferAttempts, teachBackAttempts] = await Promise.all([
    prisma.practiceAttempt.findMany({ where: { gapId: { in: gapIds } }, orderBy: { createdAt: "asc" } }),
    prisma.transferAttempt.findMany({ where: { gapId: { in: gapIds } }, orderBy: { createdAt: "asc" } }),
    prisma.teachBackAttempt.findMany({ where: { gapId: { in: gapIds } }, orderBy: { createdAt: "asc" } }),
  ]);

  // Resolve retrieved-chunk titles referenced by any call log, so the trace
  // shows what was actually retrieved rather than opaque ids.
  const chunkIdSet = new Set<string>();
  for (const log of callLogs) {
    if (!log.retrievedChunkIds) continue;
    try {
      (JSON.parse(log.retrievedChunkIds) as string[]).forEach((id) => chunkIdSet.add(id));
    } catch {
      // ignore malformed log rows
    }
  }
  const chunks = chunkIdSet.size
    ? await prisma.knowledgeChunk.findMany({ where: { id: { in: [...chunkIdSet] } } })
    : [];
  const chunkTitleById = new Map(chunks.map((c) => [c.id, c.title]));

  return NextResponse.json({
    analysis: {
      id: analysis.id,
      subject: analysis.subject,
      status: analysis.status,
      confidence: analysis.confidence,
      isDemo: analysis.isDemo,
      createdAt: analysis.createdAt,
      completedAt: analysis.completedAt,
      uploadedWork: analysis.uploadedWork,
    },
    extractedSteps: analysis.extractedSteps,
    reasoningSteps: analysis.reasoningSteps,
    gaps: analysis.gaps.map((g) => ({
      id: g.id,
      classification: g.classification,
      surfaceError: g.surfaceError,
      underlyingGap: g.underlyingGap,
      evidence: safeJsonParse(g.evidence),
      confidence: g.confidence,
      explanation: g.explanationText ? safeJsonParse(g.explanationText) : null,
      status: g.status,
      concept: { id: g.concept.id, name: g.concept.name, slug: g.concept.slug },
    })),
    callLogs: callLogs.map((l) => ({
      id: l.id,
      stage: l.stage,
      model: l.model,
      succeeded: l.succeeded,
      cached: l.cached,
      latencyMs: l.latencyMs,
      errorText: l.errorText,
      retrievedChunks: l.retrievedChunkIds
        ? (JSON.parse(l.retrievedChunkIds) as string[]).map((id) => ({
            id,
            title: chunkTitleById.get(id) ?? "(chunk no longer exists)",
          }))
        : [],
      createdAt: l.createdAt,
    })),
    practiceAttempts,
    transferAttempts,
    teachBackAttempts,
    learningEvents: analysis.learningEvents,
  });
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
