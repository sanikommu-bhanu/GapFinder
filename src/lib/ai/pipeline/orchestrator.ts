import { prisma } from "@/lib/db/prisma";
import { AiUnavailableError } from "@/lib/ai/ai-client";
import { hasAnyProvider, hasVisionProvider } from "@/lib/ai/ai-client";
import { retrieveKnowledge } from "@/lib/ai/rag/retrieve";
import { explainGapOffline } from "@/lib/ai/fallback/offline-explain";
import type { ExplanationResult } from "@/lib/ai/schemas/pipeline";
import { analyzeWork } from "./analyze-work";
import { reconstructReasoning } from "./reconstruct-reasoning";
import { verifyAndFindDivergenceDetailed, type VerifiedStep } from "./verify-and-find-divergence";
import { classifyGap } from "./classify-gap";
import { explainGap } from "./explain-gap";
import { classifyGapOffline } from "./classify-gap-offline";
import { detectMisconception, unclassified } from "@/lib/diagnosis/detect-misconception";

export interface RunPipelineParams {
  analysisId: string;
  /** Omitted when the student typed their working instead of photographing it. */
  imageBase64?: string;
  imageMimeType?: string;
  subject: string;
  textContext?: string | null;
  /** Steps the student typed directly — skips the vision stage entirely. */
  typedSteps?: string[];
}

export interface RunPipelineResult {
  status: "complete" | "needs_confirmation" | "failed";
  reason?: string;
}

/**
 * Runs the real (non-demo) analysis pipeline end to end and persists every
 * intermediate structured artifact, so the system can always answer "what did
 * the AI actually do at each step" (ExtractedStep, ReasoningStep, Gap rows).
 *
 * Stage boundaries are written to `analysis.status` as they are entered — the
 * Analyzing screen polls that, so the progress a student watches is the real
 * pipeline position rather than a timer.
 */
export async function runAnalysisPipeline(params: RunPipelineParams): Promise<RunPipelineResult> {
  await setStatus(params.analysisId, "reading");

  // Typed working needs no interpretation: the student already told us exactly
  // what each line says, which is strictly better evidence than reading a photo.
  if (params.typedSteps?.length) {
    const steps = params.typedSteps.map((line, i) => ({ order: i + 1, interpreted: line.trim() }));
    await prisma.extractedStep.createMany({
      data: steps.map((s) => ({
        analysisId: params.analysisId,
        order: s.order,
        rawLine: s.interpreted,
        interpreted: s.interpreted,
        confidence: "high",
        needsConfirm: false,
      })),
    });
    return finishFromSteps({
      analysisId: params.analysisId,
      subject: params.subject,
      steps,
      confidence: "high",
    });
  }

  if (!params.imageBase64) {
    return failWithReason(params.analysisId, "No work was submitted to analyze.");
  }

  // Reading handwriting needs a provider that accepts images. Typed working
  // has no such requirement, which is why that path is checked separately.
  if (!hasVisionProvider()) {
    return failWithReason(
      params.analysisId,
      "No AI provider is configured that can read images right now. You can still type your working out instead."
    );
  }

  // One multimodal call reads, narrates and classifies. It used to be three,
  // which cost three round-trips and three charges against the free-tier quota
  // for a single photo. Combining them is safe because nothing the model says
  // is trusted: the divergence is proved by the verifier immediately after.
  const concepts = await prisma.concept.findMany({
    select: { id: true, slug: true, name: true, subject: true, description: true, commonErrors: true },
  });
  const subjectConcepts = concepts.filter(
    (c) => c.subject.toLowerCase() === params.subject.toLowerCase()
  );
  const shortlist = subjectConcepts.length > 0 ? subjectConcepts : concepts;

  let analysis;
  try {
    analysis = await analyzeWork({
      imageBase64: params.imageBase64,
      imageMimeType: params.imageMimeType ?? "image/jpeg",
      subject: params.subject,
      availableConceptSlugs: shortlist.map((c) => c.slug),
      textContext: params.textContext,
      analysisId: params.analysisId,
    });
  } catch (err) {
    return failGracefully(params.analysisId, err);
  }

  const read = analysis.result;

  // A photograph of a question with nothing attempted has no reasoning to
  // diagnose. Saying so plainly beats "we couldn't read any steps", which
  // sounds like a failure of ours rather than a description of the page.
  if (read.isQuestionOnly || read.steps.length === 0) {
    return failWithReason(
      params.analysisId,
      read.isQuestionOnly
        ? // Prefixed so the UI can offer guided solving instead of a dead end.
          `QUESTION_ONLY: This is a question with no working yet — nothing to diagnose. We can solve it with you instead, one step at a time.`
        : "We could not read any working steps in that image. Try a straighter, better-lit photo with one problem per photo."
    );
  }

  await prisma.extractedStep.createMany({
    data: read.steps.map((s) => ({
      analysisId: params.analysisId,
      order: s.order,
      rawLine: s.rawLine,
      interpreted: s.interpreted,
      confidence: s.confidence,
      needsConfirm: s.needsConfirm,
    })),
  });

  if (read.needsConfirmation) {
    await prisma.analysis.update({
      where: { id: params.analysisId },
      data: {
        status: "needs_confirmation",
        confidence: read.overallConfidence,
        statusReason:
          read.confirmationQuestion ??
          "Some of your handwriting was hard to read. Check what we got before we analyze it.",
      },
    });
    return { status: "needs_confirmation", reason: read.confirmationQuestion ?? undefined };
  }

  return finishFromSteps({
    analysisId: params.analysisId,
    subject: params.subject,
    steps: read.steps.map((s) => ({ order: s.order, interpreted: s.interpreted })),
    confidence: read.overallConfidence,
    // Carried through so the later stages don't re-ask the model what it
    // already told us in this same call.
    preAnalysed: {
      statements: new Map(read.steps.map((s) => [s.order, s.statement])),
      conceptSlug: read.conceptSlug,
      misconceptionCode: read.misconceptionCode,
      surfaceError: read.surfaceError,
      underlyingGap: read.underlyingGap,
    },
  });
}

/**
 * Resumes the pipeline from stage 3 onward using already-confirmed/corrected
 * extracted steps. Used after a "needs_confirmation" pause where the student
 * verified or corrected the AI's handwriting reading — avoids re-calling the
 * vision model since we already have trustworthy step text.
 */
export async function continuePipelineFromSteps(params: {
  analysisId: string;
  subject: string;
  steps: { order: number; interpreted: string }[];
}): Promise<RunPipelineResult> {
  return finishFromSteps({ ...params, confidence: "high" });
}

/**
 * The shared tail of the pipeline: reconstruct -> deterministically verify ->
 * classify -> explain -> persist. Both the fresh run and the post-confirmation
 * resume land here, so there is exactly one implementation of the part that
 * decides what a gap actually is.
 */
interface PreAnalysed {
  statements: Map<number, string>;
  conceptSlug: string;
  misconceptionCode: string;
  surfaceError: string;
  underlyingGap: string;
}

async function finishFromSteps(params: {
  analysisId: string;
  subject: string;
  steps: { order: number; interpreted: string }[];
  confidence: string;
  /** Present when the combined call already narrated and classified. */
  preAnalysed?: PreAnalysed;
}): Promise<RunPipelineResult> {
  await setStatus(params.analysisId, "reconstructing");

  let reasoningSteps: { order: number; statement: string; expression: string }[];
  if (params.preAnalysed) {
    // Already narrated in the combined call — asking again would spend a
    // second request to learn what we were just told.
    reasoningSteps = params.steps.map((step) => ({
      order: step.order,
      statement: params.preAnalysed!.statements.get(step.order) ?? step.interpreted,
      expression: step.interpreted,
    }));
  } else {
    try {
      const reconstruction = await reconstructReasoning({
        subject: params.subject,
        steps: params.steps,
        analysisId: params.analysisId,
      });
      reasoningSteps = reconstruction.result.reasoningSteps;
    } catch (err) {
      return failGracefully(params.analysisId, err);
    }
  }

  await setStatus(params.analysisId, "verifying");
  const audit = verifyAndFindDivergenceDetailed(reasoningSteps);
  const verified = audit.steps;

  // The concept graph is needed by the next stage and depends on nothing here,
  // so it loads alongside the verification writes instead of after them.
  const conceptsPromise = prisma.concept.findMany({
    select: { id: true, slug: true, name: true, subject: true, description: true, commonErrors: true },
  });

  await prisma.reasoningStep.deleteMany({ where: { analysisId: params.analysisId } });
  await prisma.reasoningStep.createMany({
    data: verified.map((v) => ({
      analysisId: params.analysisId,
      order: v.order,
      statement: v.statement,
      expression: v.expression,
      isValid: v.isValid,
      isFirstGap: v.isFirstGap,
      verificationNote: v.verificationNote,
      correctedExpression: v.correctedExpression,
      verdict: v.verdict,
    })),
  });

  // The complete corrected path is derived once, here, from the student's own
  // opening line — so every screen that shows "how it should have gone" is
  // reading the same verified answer rather than deriving its own.
  await prisma.analysis.update({
    where: { id: params.analysisId },
    data: { correctedSolution: JSON.stringify(audit.correctedSolution) },
  });

  const divergence = verified.find((v) => v.isFirstGap);
  const analysis = await prisma.analysis.findUniqueOrThrow({ where: { id: params.analysisId } });

  // "No divergence found" and "nothing we could check" are different results,
  // and reporting the second as the first would claim a verification that never
  // happened — the one thing this product must never do.
  const uncertainCount = verified.filter((v) => v.verdict === "uncertain").length;
  if (uncertainCount === verified.length) {
    return failWithReason(
      params.analysisId,
      "We couldn't read this as mathematical working. Each line needs to be an equation — try again with your steps written out, one per line."
    );
  }

  if (!divergence) {
    await prisma.analysis.update({
      where: { id: params.analysisId },
      data: {
        status: "complete",
        confidence: params.confidence,
        completedAt: new Date(),
        // Say plainly when part of the work couldn't be checked.
        statusReason:
          uncertainCount > 0
            ? `${uncertainCount} line${uncertainCount === 1 ? "" : "s"} couldn't be checked, but everything we could verify holds.`
            : null,
      },
    });
    return { status: "complete" };
  }

  await setStatus(params.analysisId, "classifying");

  const allConcepts = await conceptsPromise;
  if (allConcepts.length === 0) {
    return failWithReason(params.analysisId, "The concept graph has not been seeded yet. Run npm run db:seed.");
  }

  // Narrow to the subject the student chose. Offering the model every concept
  // across four subjects invites it to classify a chemistry gap as "Sign
  // Handling" simply because the words overlap; keeping the shortlist honest is
  // what makes the concept it lands on meaningful. Cross-subject concepts stay
  // available when the subject has none of its own seeded.
  const subjectConcepts = allConcepts.filter(
    (c) => c.subject.toLowerCase() === params.subject.toLowerCase()
  );
  const concepts = subjectConcepts.length > 0 ? subjectConcepts : allConcepts;

  const prevStep = verified[verified.findIndex((v) => v.isFirstGap) - 1];

  // The combined call already chose a concept and described the error. Only
  // fall back to a separate classification request when it didn't.
  const preClassified =
    params.preAnalysed && concepts.some((c) => c.slug === params.preAnalysed!.conceptSlug)
      ? {
          conceptSlug: params.preAnalysed.conceptSlug,
          classification: params.preAnalysed.misconceptionCode,
          surfaceError: params.preAnalysed.surfaceError || divergence.verificationNote,
          underlyingGap: params.preAnalysed.underlyingGap || divergence.verificationNote,
          evidence: [{ stepOrder: divergence.order, note: divergence.verificationNote }],
          confidence: "high" as const,
        }
      : null;

  const classification =
    preClassified ??
    (await classifyWithFallback({
      subject: params.subject,
      verified,
      divergence,
      concepts,
      analysisId: params.analysisId,
    }));

  const concept = concepts.find((c) => c.slug === classification.conceptSlug) ?? concepts[0]!;

  // Identify the documented misconception behind the error. Where the algebra
  // has an unambiguous signature this is proved outright, with no model
  // involved — the same student error always produces the same code, which is
  // what makes these countable rather than merely descriptive.
  const misconception =
    detectMisconception({
      divergence,
      previousExpression: prevStep?.expression ?? "",
      subject: params.subject,
    }) ?? unclassified("No catalogue signature matched this step.");

  await setStatus(params.analysisId, "explaining");

  const explanation = await explainWithFallback({
    conceptId: concept.id,
    conceptName: concept.name,
    classification,
    divergence,
    prevStep,
    analysisId: params.analysisId,
  });

  // One transaction: a gap without its learning event would leave the memory
  // layer inconsistent with what the student can see.
  await prisma.$transaction([
    prisma.gap.create({
      data: {
        analysisId: params.analysisId,
        conceptId: concept.id,
        classification: classification.classification,
        surfaceError: classification.surfaceError,
        underlyingGap: classification.underlyingGap,
        evidence: JSON.stringify(classification.evidence),
        confidence: classification.confidence,
        explanationText: JSON.stringify(explanation),
        misconceptionCode: misconception.misconception.code,
        misconceptionBasis: misconception.basis,
        misconceptionEvidence: misconception.evidence,
        status: "open",
      },
    }),
    prisma.learningEvent.create({
      data: {
        userId: analysis.userId,
        analysisId: params.analysisId,
        type: "gap_found",
        payload: JSON.stringify({ conceptSlug: concept.slug, classification: classification.classification }),
      },
    }),
    prisma.analysis.update({
      where: { id: params.analysisId },
      data: { status: "complete", confidence: params.confidence, completedAt: new Date(), statusReason: null },
    }),
  ]);

  return { status: "complete" };
}

/**
 * Classification asks Gemini which concept broke and why. If the model is
 * unavailable the pipeline does NOT stop: the deterministic classifier reads
 * the same verified algebra and picks the concept from the shape of the error.
 * Its confidence is reported as low, so the UI can say so out loud.
 */
async function classifyWithFallback(params: {
  subject: string;
  verified: VerifiedStep[];
  divergence: VerifiedStep;
  concepts: { id: string; slug: string; name: string; description: string; commonErrors: string }[];
  analysisId: string;
}) {
  if (hasAnyProvider()) {
    try {
      const { result } = await classifyGap({
        subject: params.subject,
        steps: params.verified.map((v) => ({
          order: v.order,
          statement: v.statement,
          expression: v.expression,
          isValid: v.isValid,
        })),
        divergenceStepOrder: params.divergence.order,
        availableConceptSlugs: params.concepts.map((c) => c.slug),
        analysisId: params.analysisId,
      });
      if (params.concepts.some((c) => c.slug === result.conceptSlug)) return result;
    } catch {
      // fall through to the deterministic classifier
    }
  }
  const previous = params.verified[params.verified.findIndex((v) => v.isFirstGap) - 1];
  return classifyGapOffline({
    divergence: params.divergence,
    previousExpression: previous?.expression ?? "",
    availableConcepts: params.concepts.map((c) => ({ slug: c.slug, name: c.name })),
  });
}

/**
 * Explanation is RAG-grounded either way. With Gemini, the model must ground
 * its wording in the retrieved chunks; without it, the chunks are surfaced
 * directly alongside the verifier's algebraic account of what changed.
 */
async function explainWithFallback(params: {
  conceptId: string;
  conceptName: string;
  classification: { surfaceError: string; underlyingGap: string };
  divergence: VerifiedStep;
  prevStep: VerifiedStep | undefined;
  analysisId: string;
}): Promise<ExplanationResult> {
  const previousExpression = params.prevStep?.expression ?? params.divergence.expression;

  if (hasAnyProvider() && params.prevStep) {
    try {
      const { explanation } = await explainGap({
        conceptId: params.conceptId,
        surfaceError: params.classification.surfaceError,
        underlyingGap: params.classification.underlyingGap,
        divergingStep: { statement: params.divergence.statement, expression: params.divergence.expression },
        previousStep: { statement: params.prevStep.statement, expression: params.prevStep.expression },
        analysisId: params.analysisId,
      });
      return explanation;
    } catch {
      // fall through to the grounded offline explanation
    }
  }

  const chunks = await retrieveKnowledge(
    params.conceptId,
    `${params.classification.underlyingGap} ${params.classification.surfaceError}`,
    { kinds: ["explanation", "misconception", "teaching_strategy"], limit: 4 }
  );
  return explainGapOffline({
    conceptName: params.conceptName,
    surfaceError: params.classification.surfaceError,
    underlyingGap: params.classification.underlyingGap,
    previousExpression,
    divergingExpression: params.divergence.expression,
    correctedExpression: params.divergence.correctedExpression,
    chunks,
  });
}

async function setStatus(analysisId: string, status: string) {
  await prisma.analysis.update({ where: { id: analysisId }, data: { status } });
}

async function failWithReason(analysisId: string, reason: string): Promise<RunPipelineResult> {
  await prisma.analysis.update({ where: { id: analysisId }, data: { status: "failed", statusReason: reason } });
  return { status: "failed", reason };
}

async function failGracefully(analysisId: string, err: unknown): Promise<RunPipelineResult> {
  const reason =
    err instanceof AiUnavailableError && err.reason === "quota"
      ? "Gemini's rate limit was reached. We finished what we could verify ourselves — try again in a minute for the full explanation."
      : err instanceof AiUnavailableError && err.reason === "no_key"
        ? "Live AI isn't configured on this server, so we could only run the parts we verify locally."
        : err instanceof AiUnavailableError && err.reason === "invalid_response"
          ? "The AI returned something we could not verify, so we stopped rather than show you a guess. Please try again."
          : "Something went wrong analyzing this. Please try again.";
  return failWithReason(analysisId, reason);
}
