import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { detectAskIntent } from "@/lib/concepts/ask-intent";
import { routeQuestionToConcept } from "@/lib/concepts/route-question";
import type { MatchableConcept } from "@/lib/concepts/match-concept";
import { retrieveKnowledge } from "@/lib/ai/rag/retrieve";
import { buildConceptLesson } from "@/lib/teaching/build-concept-lesson";
import { selectConceptVisual } from "@/lib/ai/visuals/select-visual";
import { exampleFor } from "@/lib/concepts/canonical-examples";
import { MISCONCEPTIONS } from "@/lib/diagnosis/misconceptions";

/** The model router is the only call here, and it is a short one. */
export const maxDuration = 30;

const Body = z.object({
  query: z.string().min(1).max(400),
  subject: z.string().max(40).optional(),
});

/**
 * "Explain photosynthesis."
 *
 * The other half of the app. GapFinder's diagnosis needs working to compare;
 * a student who hasn't written anything yet still needs an answer, and sending
 * them away to search for one is how a learning tool loses its place in the
 * flow.
 *
 * What comes back is a lesson, a diagram and a set of sources — all assembled
 * from the curated corpus, all deterministic. A model may be asked which topic
 * was meant; it is never asked what to say about it.
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

  // Accept the raw question, however it was phrased — the intent parser strips
  // "explain", "what is", and the rest back to the topic itself.
  const intent = detectAskIntent(parsed.data.query);
  const topic = intent.kind === "concept" ? intent.topic : parsed.data.query.trim();

  const rows = await prisma.concept.findMany({
    select: { id: true, slug: true, name: true, subject: true, description: true, commonErrors: true },
  });

  const concepts: MatchableConcept[] = rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    subject: c.subject,
    description: c.description,
    commonErrors: safeList(c.commonErrors),
  }));

  const routed = await routeQuestionToConcept({
    topic,
    concepts,
    subjectHint: parsed.data.subject,
  });

  if (!routed.match) {
    return NextResponse.json(
      {
        matched: false,
        // Said plainly, with the truth about why: the corpus is curated, and a
        // curated corpus has edges.
        message:
          "That topic isn't in our verified library yet. Everything GapFinder explains is checked material, so we'd rather say so than improvise.",
        suggestions: (routed.alternatives.length > 0 ? routed.alternatives : concepts)
          .slice(0, 6)
          .map((c) => ({ slug: c.slug, name: c.name, subject: c.subject })),
      },
      { status: 200 }
    );
  }

  const concept = routed.match.concept;

  const chunks = await retrieveKnowledge(concept.id, `${topic} ${concept.name}`, { limit: 6 });
  const misconceptions = MISCONCEPTIONS.filter((m) => m.conceptSlug === concept.slug);

  const lesson = buildConceptLesson({
    conceptName: concept.name,
    subject: concept.subject,
    description: concept.description,
    commonErrors: concept.commonErrors,
    chunks: chunks.map((c) => ({ id: c.id, kind: c.kind, title: c.title, content: c.content })),
    misconceptions,
  });

  // The diagram is computed from a curated worked example, by the same selector
  // that draws a student's own verified work. Nothing is generated as an image.
  const example = exampleFor(concept.slug);
  const visual = selectConceptVisual({
    conceptSlug: example?.visualSlug ?? concept.slug,
    originalExpression: example?.expression ?? null,
    correctedExpression: example?.corrected ?? null,
  });

  return NextResponse.json({
    matched: true,
    routedBy: routed.routedBy,
    concept: {
      id: concept.id,
      slug: concept.slug,
      name: concept.name,
      subject: concept.subject,
      description: concept.description,
      commonErrors: concept.commonErrors,
    },
    visual,
    visualCaption: example?.caption ?? null,
    lesson: lesson.lines,
    citedChunkIds: lesson.citedChunkIds,
    sources: chunks.slice(0, 4).map((c) => ({ id: c.id, title: c.title, kind: c.kind })),
    misconceptions: misconceptions.map((m) => ({
      code: m.code,
      name: m.name,
      studentRule: m.studentRule,
      whyItFails: m.whyItFails,
    })),
    alternatives: routed.alternatives.slice(0, 3).map((c) => ({ slug: c.slug, name: c.name })),
  });
}

function safeList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
