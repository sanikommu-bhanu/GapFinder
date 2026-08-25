import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { runAnalysisPipeline } from "@/lib/ai/pipeline/orchestrator";
import { compressImageBase64 } from "@/lib/media/compress-image";
import { runInBackground } from "@/lib/background";

/**
 * The browser downscales to a bounded JPEG before uploading, so anything
 * arriving here is normally well under a megabyte. This ceiling only guards
 * against a client that skipped that step.
 */
const MAX_IMAGE_BASE64_CHARS = 20_000_000;

/**
 * The pipeline makes several sequential model calls. The default serverless
 * ceiling is well under that, which would kill the run mid-analysis.
 */
export const maxDuration = 60;

const PhotoBody = z.object({
  subject: z.string().min(1).max(40),
  imageBase64: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS), // raw base64, no data: prefix
  // The browser normalises to JPEG before upload; this stays permissive so an
  // undecodable-in-browser format can still reach the server's own decoder.
  imageMimeType: z.string().max(60).default("image/jpeg"),
  sourceType: z.enum(["camera", "gallery"]).default("camera"),
  textContext: z.string().max(2000).optional(),
});

const TypedBody = z.object({
  subject: z.string().min(1).max(40),
  sourceType: z.literal("typed"),
  /** One equation per line, exactly as the student wrote it. */
  steps: z.array(z.string().min(1).max(300)).min(2).max(40),
  textContext: z.string().max(2000).optional(),
});

const Body = z.union([TypedBody, PhotoBody]);

/**
 * Starts an analysis and returns immediately.
 *
 * The pipeline can run for tens of seconds. Holding the request open for that
 * long means a spinner with no information and a hard timeout on most hosts.
 * Instead the row is created, the pipeline is handed to the background runner,
 * and the Analyzing screen polls the real stage from the database.
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
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "We couldn't accept that. Send a photo of your work, or type at least two lines of working.",
      },
      { status: 400 }
    );
  }

  // Typed working: no image to store and no vision call to make.
  if (parsed.data.sourceType === "typed") {
    const { subject, steps, textContext } = parsed.data;
    const analysis = await prisma.analysis.create({
      data: {
        userId,
        subject,
        status: "pending",
        uploadedWork: {
          create: {
            imageUrl: "",
            sourceType: "typed",
            rawText: steps.join("\n"),
            textContext: textContext ?? null,
          },
        },
      },
    });

    runInBackground(
      runAnalysisPipeline({ analysisId: analysis.id, subject, typedSteps: steps, textContext }).catch(
        async (err) => {
          await markFailed(analysis.id, err);
        }
      ),
      `analysis ${analysis.id}`
    );

    return NextResponse.json({ analysisId: analysis.id, status: "pending" }, { status: 202 });
  }

  const { subject, imageBase64, imageMimeType, sourceType, textContext } = parsed.data;

  let compressed;
  try {
    // Compress before storing/sending to Gemini — conserves bandwidth and tokens.
    compressed = await compressImageBase64(imageBase64, imageMimeType);
  } catch {
    return NextResponse.json(
      { error: "We could not read that file as an image. Try taking the photo again." },
      { status: 400 }
    );
  }

  const analysis = await prisma.analysis.create({
    data: {
      userId,
      subject,
      status: "pending",
      uploadedWork: {
        create: {
          // Served by /api/uploads/[id] rather than from disk: a serverless
          // host has no writable filesystem to put the file on.
          imageUrl: "",
          imageData: compressed.base64,
          sourceType,
          rawText: null,
          textContext: textContext ?? null,
          width: compressed.width,
          height: compressed.height,
        },
      },
    },
  });

  await prisma.uploadedWork.update({
    where: { analysisId: analysis.id },
    data: { imageUrl: `/api/uploads/${analysis.id}` },
  });

  runInBackground(
    runAnalysisPipeline({
      analysisId: analysis.id,
      imageBase64: compressed.base64,
      imageMimeType: "image/jpeg",
      subject,
      textContext,
    }).catch(async (err) => {
      await markFailed(analysis.id, err);
    }),
    `analysis ${analysis.id}`
  );

  return NextResponse.json({ analysisId: analysis.id, status: "pending" }, { status: 202 });
}

async function markFailed(analysisId: string, err: unknown) {
  console.error("[analysis] pipeline crashed", analysisId, err);
  await prisma.analysis
    .update({
      where: { id: analysisId },
      data: { status: "failed", statusReason: "Something went wrong analyzing this. Please try again." },
    })
    .catch(() => {});
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20) || 20));

  const analyses = await prisma.analysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      gaps: { include: { concept: true } },
      // imageData is deliberately excluded — it would put a base64 blob into
      // every list response.
      uploadedWork: { select: { imageUrl: true, sourceType: true, rawText: true } },
    },
  });

  return NextResponse.json({ analyses });
}
