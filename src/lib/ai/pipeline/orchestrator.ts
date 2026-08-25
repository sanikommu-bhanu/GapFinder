import { prisma } from "@/lib/db/prisma";
import { AiUnavailableError } from "@/lib/ai/gemini-client";
import { readAndExtractSteps } from "./read-and-extract";
import { reconstructReasoning } from "./reconstruct-reasoning";
import { verifyAndFindDivergence } from "./verify-and-find-divergence";
import { classifyGap } from "./classify-gap";
import { explainGap } from "./explain-gap";

export interface RunPipelineParams {
  analysisId: string;
  imageBase64: string;
  imageMimeType: string;
  subject: string;
  textContext?: string | null;
}

export interface RunPipelineResult {
  status: "complete" | "needs_confirmation" | "failed";
  reason?: string;
}

/**
 * Runs the real (non-demo) analysis pipeline end to end and persists every
 * intermediate structured artifact, so the system can always answer "what did
 * the AI actually do at each step" (ExtractedStep, ReasoningStep, Gap rows).
 */
export async function runAnalysisPipeline(params: RunPipelineParams): Promise<RunPipelineResult> {
  await prisma.analysis.update({ where: { id: params.analysisId }, data: { status: "reading" } });

  let extraction;
  try {
    extraction = await readAndExtractSteps({
      imageBase64: params.imageBase64,
      imageMimeType: params.imageMimeType,
      subject: params.subject,
      textContext: params.textContext,
      analysisId: params.analysisId,
    });
  } catch (err) {
    return failGracefully(params.analysisId, err);
  }

  await prisma.extractedStep.createMany({
    data: extraction.result.steps.map((s) => ({
      analysisId: params.analysisId,
      order: s.order,
      rawLine: s.rawLine,
      interpreted: s.interpreted,
      confidence: s.confidence,
      needsConfirm: s.needsConfirm,
    })),
  });

  if (extraction.result.needsConfirmation) {
    await prisma.analysis.update({
      where: { id: params.analysisId },
      data: { status: "needs_confirmation", confidence: extraction.result.overallConfidence },
    });
    return { status: "needs_confirmation", reason: extraction.result.confirmationQuestion ?? undefined };
  }

  await prisma.analysis.update({ where: { id: params.analysisId }, data: { status: "reconstructing" } });

  let reconstruction;
  try {
    reconstruction = await reconstructReasoning({
      subject: params.subject,
      steps: extraction.result.steps.map((s) => ({ order: s.order, interpreted: s.interpreted })),
      analysisId: params.analysisId,
    });
  } catch (err) {
    return failGracefully(params.analysisId, err);
  }

  await prisma.analysis.update({ where: { id: params.analysisId }, data: { status: "verifying" } });

  const verified = verifyAndFindDivergence(reconstruction.result.reasoningSteps);

  await prisma.reasoningStep.createMany({
    data: verified.map((v) => ({
      analysisId: params.analysisId,
      order: v.order,
      statement: v.statement,
      expression: v.expression,
      isValid: v.isValid,
      isFirstGap: v.isFirstGap,
      verificationNote: v.verificationNote,
    })),
  });

  const divergence = verified.find((v) => v.isFirstGap);

  if (!divergence) {
    // No error found — everything verified. Still a complete, honest result.
    await prisma.analysis.update({
      where: { id: params.analysisId },
      data: { status: "complete", confidence: extraction.result.overallConfidence, completedAt: new Date() },
    });
    return { status: "complete" };
  }

  const concepts = await prisma.concept.findMany({ select: { id: true, slug: true } });
  const prevStep = verified[verified.findIndex((v) => v.isFirstGap) - 1];

  let classification;
  try {
    classification = await classifyGap({
      subject: params.subject,
      steps: verified.map((v) => ({ order: v.order, statement: v.statement, expression: v.expression, isValid: v.isValid })),
      divergenceStepOrder: divergence.order,
      availableConceptSlugs: concepts.map((c) => c.slug),
      analysisId: params.analysisId,
    });
  } catch (err) {
    return failGracefully(params.analysisId, err);
  }

  const concept = concepts.find((c) => c.slug === classification.result.conceptSlug) ?? concepts[0];
  if (!concept) {
    await prisma.analysis.update({ where: { id: params.analysisId }, data: { status: "failed" } });
    return { status: "failed", reason: "No concept graph seeded." };
  }

  let explanationData: Awaited<ReturnType<typeof explainGap>> | null = null;
  if (prevStep) {
    try {
      explanationData = await explainGap({
        conceptId: concept.id,
        surfaceError: classification.result.surfaceError,
        underlyingGap: classification.result.underlyingGap,
        divergingStep: { statement: divergence.statement, expression: divergence.expression },
        previousStep: { statement: prevStep.statement, expression: prevStep.expression },
        analysisId: params.analysisId,
      });
    } catch {
      explanationData = null; // explanation is best-effort; gap is still recorded
    }
  }

  await prisma.gap.create({
    data: {
      analysisId: params.analysisId,
      conceptId: concept.id,
      classification: classification.result.classification,
      surfaceError: classification.result.surfaceError,
      underlyingGap: classification.result.underlyingGap,
      evidence: JSON.stringify(classification.result.evidence),
      confidence: classification.result.confidence,
      explanationText: explanationData
        ? JSON.stringify(explanationData.explanation)
        : null,
      status: "open",
    },
  });

  await prisma.learningEvent.create({
    data: {
      userId: (await prisma.analysis.findUniqueOrThrow({ where: { id: params.analysisId } })).userId,
      analysisId: params.analysisId,
      type: "gap_found",
      payload: JSON.stringify({ conceptSlug: concept.slug }),
    },
  });

  await prisma.analysis.update({
    where: { id: params.analysisId },
    data: { status: "complete", confidence: extraction.result.overallConfidence, completedAt: new Date() },
  });

  return { status: "complete" };
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
  await prisma.analysis.update({ where: { id: params.analysisId }, data: { status: "reconstructing" } });

  let reconstruction;
  try {
    reconstruction = await reconstructReasoning({ subject: params.subject, steps: params.steps, analysisId: params.analysisId });
  } catch (err) {
    return failGracefully(params.analysisId, err);
  }

  await prisma.analysis.update({ where: { id: params.analysisId }, data: { status: "verifying" } });
  const verified = verifyAndFindDivergence(reconstruction.result.reasoningSteps);

  await prisma.reasoningStep.createMany({
    data: verified.map((v) => ({
      analysisId: params.analysisId,
      order: v.order,
      statement: v.statement,
      expression: v.expression,
      isValid: v.isValid,
      isFirstGap: v.isFirstGap,
      verificationNote: v.verificationNote,
    })),
  });

  const divergence = verified.find((v) => v.isFirstGap);
  if (!divergence) {
    await prisma.analysis.update({
      where: { id: params.analysisId },
      data: { status: "complete", completedAt: new Date() },
    });
    return { status: "complete" };
  }

  const concepts = await prisma.concept.findMany({ select: { id: true, slug: true } });
  const prevStep = verified[verified.findIndex((v) => v.isFirstGap) - 1];

  let classification;
  try {
    classification = await classifyGap({
      subject: params.subject,
      steps: verified.map((v) => ({ order: v.order, statement: v.statement, expression: v.expression, isValid: v.isValid })),
      divergenceStepOrder: divergence.order,
      availableConceptSlugs: concepts.map((c) => c.slug),
      analysisId: params.analysisId,
    });
  } catch (err) {
    return failGracefully(params.analysisId, err);
  }

  const concept = concepts.find((c) => c.slug === classification.result.conceptSlug) ?? concepts[0];
  if (!concept) {
    await prisma.analysis.update({ where: { id: params.analysisId }, data: { status: "failed" } });
    return { status: "failed", reason: "No concept graph seeded." };
  }

  let explanationData: Awaited<ReturnType<typeof explainGap>> | null = null;
  if (prevStep) {
    try {
      explanationData = await explainGap({
        conceptId: concept.id,
        surfaceError: classification.result.surfaceError,
        underlyingGap: classification.result.underlyingGap,
        divergingStep: { statement: divergence.statement, expression: divergence.expression },
        previousStep: { statement: prevStep.statement, expression: prevStep.expression },
        analysisId: params.analysisId,
      });
    } catch {
      explanationData = null;
    }
  }

  await prisma.gap.create({
    data: {
      analysisId: params.analysisId,
      conceptId: concept.id,
      classification: classification.result.classification,
      surfaceError: classification.result.surfaceError,
      underlyingGap: classification.result.underlyingGap,
      evidence: JSON.stringify(classification.result.evidence),
      confidence: classification.result.confidence,
      explanationText: explanationData ? JSON.stringify(explanationData.explanation) : null,
      status: "open",
    },
  });

  const owningAnalysis = await prisma.analysis.findUniqueOrThrow({ where: { id: params.analysisId } });
  await prisma.learningEvent.create({
    data: {
      userId: owningAnalysis.userId,
      analysisId: params.analysisId,
      type: "gap_found",
      payload: JSON.stringify({ conceptSlug: concept.slug }),
    },
  });

  await prisma.analysis.update({
    where: { id: params.analysisId },
    data: { status: "complete", completedAt: new Date() },
  });

  return { status: "complete" };
}

async function failGracefully(analysisId: string, err: unknown): Promise<RunPipelineResult> {
  const isQuota = err instanceof AiUnavailableError && err.reason === "quota";
  const isNoKey = err instanceof AiUnavailableError && err.reason === "no_key";
  await prisma.analysis.update({ where: { id: analysisId }, data: { status: "failed" } });
  return {
    status: "failed",
    reason: isQuota
      ? "Gemini's free-tier limit was reached. Try again shortly, or explore Demo Mode."
      : isNoKey
        ? "AI is not configured yet. Try Demo Mode to see the full experience."
        : "Something went wrong analyzing this. Please try again.",
  };
}
