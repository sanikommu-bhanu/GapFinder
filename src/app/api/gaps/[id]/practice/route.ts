import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { hasAnyProvider } from "@/lib/ai/ai-client";
import { selectDifficulty } from "@/lib/ai/pipeline/select-intervention";
import { generatePracticeProblem } from "@/lib/ai/pipeline/generate-practice";
import {
  buildDeterministicProblem,
  validateGeneratedProblem,
  type GeneratedProblem,
} from "@/lib/ai/fallback/practice-templates";
import { getMisconceptionProfile } from "@/lib/services/misconception-history";

/** This route calls Gemini; the default serverless ceiling is too low. */
export const maxDuration = 60;

const Body = z.object({ mode: z.enum(["repair", "transfer"]).default("repair") });

/**
 * Produces one practice problem aimed at this gap.
 *
 * Difficulty is chosen deterministically from the student's mastery and recent
 * attempts, so the model is told what to build rather than asked to also decide
 * how hard it should be. Whatever comes back — from Gemini or from the local
 * generator — is solved independently before it is shown: a problem whose
 * stated answer is not actually its answer is discarded, never displayed.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const mode = parsed.success ? parsed.data.mode : "repair";

  const gap = await prisma.gap.findFirst({
    where: { id: params.id, analysis: { userId } },
    include: { concept: true },
  });
  if (!gap) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [mastery, priorAttempts, priorProblems, profile] = await Promise.all([
    prisma.masteryRecord.findUnique({
      where: { userId_conceptId: { userId, conceptId: gap.conceptId } },
    }),
    prisma.practiceAttempt.findMany({
      where: { gap: { conceptId: gap.conceptId, analysis: { userId } } },
      orderBy: { createdAt: "asc" },
      select: { isCorrect: true },
    }),
    // Don't hand a student the same problem twice in a row.
    prisma.practiceProblem.findMany({
      where: { conceptId: gap.conceptId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { prompt: true },
    }),
    // The learner's own error pattern, so we can name the mistake we expect
    // before they start rather than only diagnosing it afterwards.
    getMisconceptionProfile(userId),
  ]);

  const avoidPrompts = priorProblems.map((p) => p.prompt);
  const difficulty =
    mode === "transfer"
      ? "transfer"
      : selectDifficulty({
          currentMasteryScore: mastery?.masteryScore ?? 0,
          recentAttempts: priorAttempts,
          isFirstEncounter: priorAttempts.length === 0,
        });

  let chosen: GeneratedProblem | null = null;
  let rejectedByValidator = false;

  if (hasAnyProvider()) {
    try {
      const { result } = await generatePracticeProblem({
        conceptName: gap.concept.name,
        conceptDescription: gap.concept.description,
        difficulty,
        mode,
        avoidPrompts,
        analysisId: gap.analysisId,
      });
      if (validateGeneratedProblem(result.prompt, result.correctAnswer)) {
        chosen = { ...result, source: "gemini" };
      } else {
        // The model produced a problem whose answer doesn't check out. Log it
        // and fall through — showing it would teach the student something false.
        rejectedByValidator = true;
        console.warn("[practice] rejected unverifiable generated problem", {
          prompt: result.prompt,
          claimedAnswer: result.correctAnswer,
        });
      }
    } catch (err) {
      console.warn("[practice] generation unavailable, using local generator", err);
    }
  }

  if (!chosen) {
    chosen = buildDeterministicProblem({
      conceptSlug: gap.concept.slug,
      difficulty,
      mode,
      seed: `${gap.id}:${mode}:${priorAttempts.length}`,
      avoidPrompts,
    });
  }

  if (!chosen) {
    return NextResponse.json(
      { error: "We couldn't build a verified problem for this concept right now. Please try again." },
      { status: 503 }
    );
  }

  const problem = await prisma.practiceProblem.create({
    data: {
      conceptId: gap.conceptId,
      difficulty: chosen.difficulty,
      prompt: chosen.prompt,
      correctAnswer: chosen.correctAnswer,
      isGenerated: chosen.source === "gemini",
    },
  });

  return NextResponse.json({
    problem: { id: problem.id, prompt: problem.prompt, difficulty: problem.difficulty },
    concept: { name: gap.concept.name, slug: gap.concept.slug },
    // Surfaced in the UI so the student always knows what produced their problem.
    source: chosen.source,
    rejectedByValidator,
    // Stated up front, then checked against what they actually do.
    prediction: profile.prediction
      ? {
          code: profile.prediction.code,
          name: profile.prediction.misconception.name,
          studentRule: profile.prediction.misconception.studentRule,
          likelihood: profile.prediction.likelihood,
          occurrences: profile.prediction.occurrences,
          because: profile.prediction.because,
        }
      : null,
  });
}
