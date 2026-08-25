import { prisma } from "@/lib/db/prisma";
import { hasGeminiKey } from "@/lib/env";
import { selectDifficulty } from "@/lib/ai/pipeline/select-intervention";
import { generatePracticeProblem } from "@/lib/ai/pipeline/generate-practice";
import {
  buildDeterministicProblem,
  validateGeneratedProblem,
  type GeneratedProblem,
} from "@/lib/ai/fallback/practice-templates";

/**
 * Builds an exam from what the student has actually worked on.
 *
 * The point of Exam Mode is to test whether a repair held once the scaffolding
 * is gone, so the questions come from concepts with real history — gaps that
 * were repaired or transferred — rather than from a syllabus. A concept the
 * student has never met has nothing to verify.
 *
 * Every question is validated before it is shown: the stated answer is solved
 * independently, and anything unverifiable is discarded. Showing a broken
 * question in a graded exam would penalise a student for our mistake.
 */

export interface ExamCandidate {
  conceptId: string;
  conceptName: string;
  conceptSlug: string;
  /** Why this concept is being examined, shown to the student. */
  reason: string;
  masteryScore: number;
}

/** An exam needs enough questions per concept to mean anything. */
export const QUESTIONS_PER_CONCEPT = 2;
export const MAX_CONCEPTS = 3;

/**
 * Concepts worth examining, most-recently-repaired first.
 *
 * Ordering by recency rather than weakness is deliberate: the interesting
 * question is whether a *recent* repair survived without help, and a concept
 * repaired months ago tells you about retention, not about the repair.
 */
export async function findExamCandidates(userId: string): Promise<ExamCandidate[]> {
  const gaps = await prisma.gap.findMany({
    where: { analysis: { userId }, status: { in: ["repaired", "closed"] } },
    include: { concept: true },
    orderBy: { createdAt: "desc" },
  });

  const mastery = await prisma.masteryRecord.findMany({ where: { userId } });
  const masteryByConcept = new Map(mastery.map((m) => [m.conceptId, m.masteryScore]));

  const seen = new Set<string>();
  const candidates: ExamCandidate[] = [];

  for (const gap of gaps) {
    if (seen.has(gap.conceptId)) continue;
    seen.add(gap.conceptId);
    candidates.push({
      conceptId: gap.conceptId,
      conceptName: gap.concept.name,
      conceptSlug: gap.concept.slug,
      reason:
        gap.status === "closed"
          ? `You repaired this and passed a transfer problem. Let's see if it holds without help.`
          : `You repaired this in practice. The exam checks whether it stuck.`,
      masteryScore: masteryByConcept.get(gap.conceptId) ?? 0,
    });
    if (candidates.length >= MAX_CONCEPTS) break;
  }

  return candidates;
}

export interface ExamQuestionDraft {
  conceptId: string;
  prompt: string;
  correctAnswer: string;
  source: "gemini" | "deterministic";
}

/**
 * Generates and validates the questions for one concept.
 *
 * `avoid` carries every prompt the student has already seen for this concept,
 * so an exam cannot re-ask a practice question verbatim — that would measure
 * recall of one problem rather than command of the concept.
 */
export async function buildQuestionsForConcept(params: {
  userId: string;
  candidate: ExamCandidate;
  count: number;
}): Promise<ExamQuestionDraft[]> {
  const { userId, candidate, count } = params;

  const [priorProblems, attempts] = await Promise.all([
    prisma.practiceProblem.findMany({
      where: { conceptId: candidate.conceptId },
      select: { prompt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.practiceAttempt.findMany({
      where: { gap: { conceptId: candidate.conceptId, analysis: { userId } } },
      select: { isCorrect: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const avoid = priorProblems.map((p) => p.prompt);
  const difficulty = selectDifficulty({
    currentMasteryScore: candidate.masteryScore,
    recentAttempts: attempts,
    isFirstEncounter: false,
  });

  const drafts: ExamQuestionDraft[] = [];

  for (let i = 0; i < count; i++) {
    const seen = [...avoid, ...drafts.map((d) => d.prompt)];
    const question = await generateOne({
      conceptId: candidate.conceptId,
      conceptSlug: candidate.conceptSlug,
      conceptName: candidate.conceptName,
      difficulty,
      avoid: seen,
      seed: `${candidate.conceptId}:exam:${Date.now()}:${i}`,
    });
    if (question) drafts.push(question);
  }

  return drafts;
}

async function generateOne(params: {
  conceptId: string;
  conceptSlug: string;
  conceptName: string;
  difficulty: ReturnType<typeof selectDifficulty>;
  avoid: string[];
  seed: string;
}): Promise<ExamQuestionDraft | null> {
  const { conceptId, conceptSlug, conceptName, difficulty, avoid, seed } = params;

  if (hasGeminiKey()) {
    try {
      const concept = await prisma.concept.findUnique({ where: { id: conceptId } });
      const { result } = await generatePracticeProblem({
        conceptName,
        conceptDescription: concept?.description ?? conceptName,
        difficulty,
        mode: "repair",
        avoidPrompts: avoid,
      });
      // Same gate as practice: solve it independently or don't show it.
      const isNew = !avoid.some((p) => p.replace(/\s/g, "") === result.prompt.replace(/\s/g, ""));
      if (isNew && validateGeneratedProblem(result.prompt, result.correctAnswer)) {
        return {
          conceptId,
          prompt: result.prompt,
          correctAnswer: result.correctAnswer,
          source: "gemini",
        };
      }
    } catch {
      // Fall through to the local generator.
    }
  }

  const local: GeneratedProblem | null = buildDeterministicProblem({
    conceptSlug,
    difficulty,
    mode: "repair",
    seed,
    avoidPrompts: avoid,
  });

  return local
    ? { conceptId, prompt: local.prompt, correctAnswer: local.correctAnswer, source: "deterministic" }
    : null;
}
