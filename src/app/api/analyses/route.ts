import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { runAnalysisPipeline } from "@/lib/ai/pipeline/orchestrator";
import { compressImageBase64 } from "@/lib/media/compress-image";

const Body = z.object({
  subject: z.string(),
  imageBase64: z.string(), // raw base64, no data: prefix
  imageMimeType: z.string().default("image/jpeg"),
  sourceType: z.enum(["camera", "gallery", "typed"]).default("camera"),
  textContext: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { subject, imageBase64, imageMimeType, sourceType, textContext } = parsed.data;

  // Compress before storing/sending to Gemini — conserves bandwidth and tokens.
  const compressed = await compressImageBase64(imageBase64, imageMimeType);

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
          rawText: sourceType === "typed" ? textContext ?? null : null,
          textContext: textContext ?? null,
          width: compressed.width,
          height: compressed.height,
        },
      },
    },
  });

  const result = await runAnalysisPipeline({
    analysisId: analysis.id,
    imageBase64: compressed.base64,
    imageMimeType: "image/jpeg",
    subject,
    textContext,
  });

  return NextResponse.json({ analysisId: analysis.id, ...result });
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 20);

  const analyses = await prisma.analysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { gaps: { include: { concept: true } }, uploadedWork: true },
  });

  return NextResponse.json({ analyses });
}
