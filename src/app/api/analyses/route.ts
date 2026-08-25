import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { runAnalysisPipeline } from "@/lib/ai/pipeline/orchestrator";
import { compressImageBase64 } from "@/lib/media/compress-image";

/** 8 MB of base64 is roughly a 6 MB photo — beyond that we reject rather than OOM. */
const MAX_IMAGE_BASE64_CHARS = 8_000_000;

const PhotoBody = z.object({
  subject: z.string().min(1).max(40),
  imageBase64: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS), // raw base64, no data: prefix
  imageMimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]).default("image/jpeg"),
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
 * The pipeline makes several sequential model calls and can run for tens of
 * seconds. Holding the request open for that long means a spinner with no
 * information, a hard timeout on most hosts, and nothing to show if the user
 * backgrounds the app. Instead the row is created, the pipeline is kicked off,
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
          "We couldn't accept that. Send a JPEG or PNG under about 6 MB, or type at least two lines of working.",
      },
      { status: 400 }
    );
  }

  // Typed working: no image to compress or store, and no vision call to make.
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

    void runAnalysisPipeline({
      analysisId: analysis.id,
      subject,
      typedSteps: steps,
      textContext,
    }).catch(async (err) => {
      console.error("[analysis] pipeline crashed", analysis.id, err);
      await prisma.analysis
        .update({
          where: { id: analysis.id },
          data: { status: "failed", statusReason: "Something went wrong analyzing this. Please try again." },
        })
        .catch(() => {});
    });

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

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  await writeFile(path.join(uploadsDir, fileName), Buffer.from(compressed.base64, "base64"));
  const imageUrl = `/uploads/${fileName}`;

  const analysis = await prisma.analysis.create({
    data: {
      userId,
      subject,
      status: "pending",
      uploadedWork: {
        create: {
          imageUrl,
          sourceType,
          rawText: null,
          textContext: textContext ?? null,
          width: compressed.width,
          height: compressed.height,
        },
      },
    },
  });

  // Fire-and-forget: the client follows progress via GET /api/analyses/[id]/status.
  // Any escape from the pipeline is recorded on the row so the UI can explain it
  // rather than spinning forever.
  void runAnalysisPipeline({
    analysisId: analysis.id,
    imageBase64: compressed.base64,
    imageMimeType: "image/jpeg",
    subject,
    textContext,
  }).catch(async (err) => {
    console.error("[analysis] pipeline crashed", analysis.id, err);
    await prisma.analysis
      .update({
        where: { id: analysis.id },
        data: {
          status: "failed",
          statusReason: "Something went wrong analyzing this. Please try again.",
        },
      })
      .catch(() => {});
  });

  return NextResponse.json({ analysisId: analysis.id, status: "pending" }, { status: 202 });
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
    include: { gaps: { include: { concept: true } }, uploadedWork: true },
  });

  return NextResponse.json({ analyses });
}
