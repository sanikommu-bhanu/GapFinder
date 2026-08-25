import { z } from "zod";
import { generateStructured, hasAnyProvider } from "@/lib/ai/ai-client";
import { matchConcept, type MatchableConcept, type ConceptMatch } from "./match-concept";

/**
 * Deciding which concept a student's question is about.
 *
 * The deterministic matcher answers most questions on its own. Where it can't,
 * a model is asked — but only to *choose from a fixed list of slugs*, never to
 * write anything. That keeps the app's rule intact: the model interprets what
 * the student meant; the content they then receive is entirely curated.
 *
 * If neither can route the question, this says so. Being told "that isn't in
 * the library yet, here's what is" is honest; being handed a confident
 * explanation of the wrong topic is not.
 */

export interface RoutingResult {
  match: ConceptMatch | null;
  /** How the concept was chosen, shown in the UI so the routing is auditable. */
  routedBy: "keyword" | "model" | null;
  /** Nearest concepts to offer when nothing matched well enough. */
  alternatives: MatchableConcept[];
}

const Choice = z.object({
  slug: z.string().describe("The slug of the closest concept, or the exact string NONE."),
  confidence: z.enum(["high", "medium", "low"]),
});

export async function routeQuestionToConcept(params: {
  topic: string;
  concepts: MatchableConcept[];
  subjectHint?: string;
}): Promise<RoutingResult> {
  const { topic, concepts, subjectHint } = params;

  const local = matchConcept(topic, concepts, { subjectHint });
  if (local.best) return { match: local.best, routedBy: "keyword", alternatives: local.alternatives };

  if (!hasAnyProvider()) {
    return { match: null, routedBy: null, alternatives: local.alternatives };
  }

  try {
    const { data } = await generateStructured({
      stage: "route-question",
      schema: Choice,
      systemInstruction:
        "You route a student's question to the single closest topic in a fixed list. " +
        "You never explain, teach, or invent a topic. Reply with one slug from the list, " +
        "or the exact string NONE if the question is not about any of them. " +
        "NONE is the correct answer surprisingly often — prefer it over a loose match.",
      prompt: [
        "Student's question:",
        topic,
        "",
        "Available topics (slug — name — subject):",
        ...concepts.map((c) => `${c.slug} — ${c.name} — ${c.subject}`),
      ].join("\n"),
      cacheTtlHours: 24 * 30,
    });

    if (data.slug === "NONE" || data.confidence === "low") {
      return { match: null, routedBy: null, alternatives: local.alternatives };
    }

    const concept = concepts.find((c) => c.slug === data.slug);
    if (!concept) return { match: null, routedBy: null, alternatives: local.alternatives };

    return {
      match: { concept, score: 0, via: "name" },
      routedBy: "model",
      alternatives: local.alternatives.filter((c) => c.slug !== concept.slug),
    };
  } catch {
    // A router that is down costs us a fallback, not the request.
    return { match: null, routedBy: null, alternatives: local.alternatives };
  }
}
