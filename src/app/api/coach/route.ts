import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { hasGeminiKey } from "@/lib/env";
import { generateStructured } from "@/lib/ai/gemini-client";
import { CoachReplyResult } from "@/lib/ai/schemas/pipeline";
import { retrieveAcrossConcepts } from "@/lib/ai/rag/retrieve";
import { coachReplyOffline } from "@/lib/ai/fallback/offline-coach";

const Body = z.object({ message: z.string().min(1).max(1000) });

const SYSTEM = `You are GapFinder's AI Coach. Answer the student's question using
ONLY the provided context: their recent recurring gaps, mastery scores, and
retrieved knowledge chunks. If the context doesn't cover their question, say so
honestly rather than inventing an answer. Keep replies to 2-4 sentences, warm
and specific. Refer to the student's own record when it's relevant — you can see
which concepts they keep slipping on. Cite groundedInChunkIds you actually used.`;

/**
 * The coach is a retrieval-grounded assistant, not a general chatbot: it can
 * only draw on the curated knowledge base plus this student's own learning
 * record, so its answers stay about their actual work and can be traced back to
 * a source.
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });

  const [memory, masteryRecords, openGaps, latestAnalysis] = await Promise.all([
    prisma.learningMemory.findUnique({ where: { userId } }),
    prisma.masteryRecord.findMany({
      where: { userId },
      include: { concept: true },
      orderBy: { masteryScore: "asc" },
      take: 5,
    }),
    prisma.gap.findMany({
      where: { analysis: { userId }, status: "open" },
      include: { concept: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // The coach isn't tied to one analysis, but attaching the most recent one
    // keeps the call inside that session's observability trace.
    prisma.analysis.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);

  const boostConceptIds = [
    ...openGaps.map((g) => g.conceptId),
    ...masteryRecords.slice(0, 2).map((m) => m.conceptId),
  ];

  const chunks = await retrieveAcrossConcepts(parsed.data.message, { limit: 4, boostConceptIds });

  const recurringGaps: { conceptId: string; count: number }[] = (() => {
    try {
      return memory ? JSON.parse(memory.recurringGaps) : [];
    } catch {
      return [];
    }
  })();

  const topRecurring = recurringGaps.slice().sort((a, b) => b.count - a.count)[0];
  const topRecurringConcept = topRecurring
    ? masteryRecords.find((m) => m.conceptId === topRecurring.conceptId)?.concept ??
      openGaps.find((g) => g.conceptId === topRecurring.conceptId)?.concept
    : undefined;

  if (hasGeminiKey()) {
    try {
      const { data } = await generateStructured({
        stage: "coach_reply",
        schema: CoachReplyResult,
        systemInstruction: SYSTEM,
        skipCache: true,
        prompt: JSON.stringify({
          question: parsed.data.message,
          recurringGaps: recurringGaps.map((g) => ({
            concept:
              masteryRecords.find((m) => m.conceptId === g.conceptId)?.concept.name ??
              openGaps.find((o) => o.conceptId === g.conceptId)?.concept.name ??
              "unknown",
            timesSeen: g.count,
          })),
          openGaps: openGaps.map((g) => ({ concept: g.concept.name, underlyingGap: g.underlyingGap })),
          weakestConcepts: masteryRecords.map((m) => ({ name: m.concept.name, score: m.masteryScore })),
          knowledgeChunks: chunks.map((c) => ({ id: c.id, title: c.title, content: c.content })),
        }),
        analysisId: latestAnalysis?.id,
        retrievedChunkIds: chunks.map((c) => c.id),
      });
      return NextResponse.json({ reply: { ...data, offline: false }, chunks });
    } catch (err) {
      console.warn("[coach] falling back to retrieval-only reply", err);
    }
  }

  const offline = coachReplyOffline({
    question: parsed.data.message,
    chunks,
    focusConceptName: topRecurringConcept?.name,
    recurringGapCount: topRecurring?.count,
  });
  return NextResponse.json({ reply: offline, chunks });
}
