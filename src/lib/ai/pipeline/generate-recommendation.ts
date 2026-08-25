import { generateStructured } from "@/lib/ai/gemini-client";
import { z } from "zod";

const ReasonPhrasing = z.object({ reason: z.string() });

const SYSTEM = `Write a single encouraging sentence (max 22 words) explaining why
this concept is the student's recommended next step, using ONLY the evidence
provided (recent gaps, mastery scores, prerequisite relationships, and any
commonly-confused-with warning). Do not invent evidence.`;

export interface MasteryInput {
  conceptId: string;
  conceptSlug: string;
  conceptName: string;
  masteryScore: number;
}

export interface RecommendationCandidate {
  conceptId: string;
  conceptSlug: string;
  priority: number;
  reason: string;
}

/**
 * Deterministically ranks candidate concepts: recurring gaps and low-mastery
 * prerequisites outrank everything else. The LLM is used only to phrase a
 * human-readable justification for the #1 candidate — it never chooses WHICH
 * concept, only HOW to explain it, keeping recommendations auditable.
 */
export async function generateRecommendation(params: {
  masteryRecords: MasteryInput[];
  recurringGapConceptIds: string[];
  prerequisiteEdges: { fromSlug: string; toSlug: string }[]; // fromSlug is prerequisite of toSlug
  /** Pairs of concept slugs the knowledge graph flags as commonly mixed up by students. */
  commonlyConfusedEdges?: { aSlug: string; bSlug: string }[];
  /**
   * Concepts the student can actually start now. Recommending a locked concept
   * as "next" contradicts the roadmap on the very same screen, so anything
   * still gated by an unmet prerequisite is excluded from the ranking.
   */
  unlockedConceptIds?: string[];
  /**
   * This call is cross-analysis (it reasons over the whole roadmap, not one
   * upload), so there's no single owning analysis the way there is for
   * per-upload stages. We still attach the student's most recent analysis id
   * purely so the AI Observability trace view has a jump-off point to the
   * rest of that session — it is a traceability link, not a claim that this
   * call belongs to that analysis.
   */
  latestAnalysisId?: string;
}): Promise<RecommendationCandidate | null> {
  const confusedWith = new Map<string, string[]>();
  for (const e of params.commonlyConfusedEdges ?? []) {
    confusedWith.set(e.aSlug, [...(confusedWith.get(e.aSlug) ?? []), e.bSlug]);
    confusedWith.set(e.bSlug, [...(confusedWith.get(e.bSlug) ?? []), e.aSlug]);
  }

  const reachable = params.unlockedConceptIds
    ? new Set(params.unlockedConceptIds)
    : null;

  const scored = params.masteryRecords
    .filter((m) => !reachable || reachable.has(m.conceptId))
    .map((m) => {
      let score = 100 - m.masteryScore;
      if (params.recurringGapConceptIds.includes(m.conceptId)) score += 30;
      const isPrereqBlocking = params.prerequisiteEdges.some(
        (e) => e.fromSlug === m.conceptSlug && m.masteryScore < 70
      );
      if (isPrereqBlocking) score += 15;
      // If this concept is commonly confused with one the student recently
      // struggled on (a recurring gap), reinforcing it now helps the student
      // tell the two apart before the confusion compounds.
      const confusedSlugs = confusedWith.get(m.conceptSlug) ?? [];
      const isConfusableWithRecentGap = confusedSlugs.some((slug) =>
        params.masteryRecords.some(
          (other) => other.conceptSlug === slug && params.recurringGapConceptIds.includes(other.conceptId)
        )
      );
      if (isConfusableWithRecentGap) score += 10;
      return { ...m, priority: Math.min(100, Math.round(score)), isConfusableWithRecentGap };
    })
    .sort((a, b) => b.priority - a.priority);

  const top = scored[0];
  if (!top) return null;

  const fallbackReason = top.isConfusableWithRecentGap
    ? `Your mastery here is ${top.masteryScore}% and it's easy to mix up with a concept you recently struggled on — worth reinforcing the distinction now.`
    : `Your mastery here is ${top.masteryScore}% — strengthening it will unlock related concepts.`;

  try {
    const { data } = await generateStructured({
      stage: "phrase_recommendation",
      schema: ReasonPhrasing,
      systemInstruction: SYSTEM,
      prompt: JSON.stringify({
        concept: top.conceptName,
        masteryScore: top.masteryScore,
        isRecurringGap: params.recurringGapConceptIds.includes(top.conceptId),
        isConfusableWithRecentGap: top.isConfusableWithRecentGap,
      }),
      analysisId: params.latestAnalysisId,
    });
    return { conceptId: top.conceptId, conceptSlug: top.conceptSlug, priority: top.priority, reason: data.reason };
  } catch {
    return { conceptId: top.conceptId, conceptSlug: top.conceptSlug, priority: top.priority, reason: fallbackReason };
  }
}
