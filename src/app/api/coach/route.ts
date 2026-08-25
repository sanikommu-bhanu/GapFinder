import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { generateStructured, AiUnavailableError } from "@/lib/ai/gemini-client";
import { CoachReplyResult } from "@/lib/ai/schemas/pipeline";
import { retrieveKnowledge } from "@/lib/ai/rag/retrieve";

const Body = z.object({ message: z.string().min(1) });

const SYSTEM = `You are GapFinder's AI Coach. Answer the student's question using
ONLY the provided context: their recent recurring gaps, mastery scores, and
retrieved knowledge chunks. If the context doesn't cover their question, say so
honestly rather than inventing an answer. Keep replies to 2-4 sentences, warm
and specific. Cite groundedInChunkIds you actually used.`;

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [memory, masteryRecords, latestAnalysis] = await Promise.all([
    prisma.learningMemory.findUnique({ where: { userId } }),
    prisma.masteryRecord.findMany({ where: { userId }, include: { concept: true }, orderBy: { masteryScore: "asc" }, take: 5 }),
    // The coach isn't tied to one analysis, but we still attach the most recent
    // one so this call shows up in that session's AI Observability trace
    // instead of floating disconnected from any diagnosable context.
    prisma.analysis.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);

  const weakestConcept = masteryRecords[0]?.concept;
  const chunks = weakestConcept
    ? await retrieveKnowledge(weakestConcept.id, parsed.data.message, { limit: 4 })
    : [];

  try {
    const { data } = await generateStructured({
      stage: "coach_reply",
      schema: CoachReplyResult,
      systemInstruction: SYSTEM,
      skipCache: true, // conversational — caching identical questions is fine but
      prompt: JSON.stringify({
        question: parsed.data.message,
        recurringGaps: memory ? JSON.parse(memory.recurringGaps) : [],
        weakestConcepts: masteryRecords.map((m) => ({ name: m.concept.name, score: m.masteryScore })),
        knowledgeChunks: chunks.map((c) => ({ id: c.id, title: c.title, content: c.content })),
      }),
      analysisId: latestAnalysis?.id,
      retrievedChunkIds: chunks.map((c) => c.id),
    });
    return NextResponse.json({ reply: data, chunks });
  } catch (err) {
    const reason =
      err instanceof AiUnavailableError && err.reason === "quota"
        ? "The coach hit Gemini's free-tier limit — try again in a bit."
        : "The coach couldn't respond right now.";
    return NextResponse.json({ error: reason }, { status: 503 });
  }
}
