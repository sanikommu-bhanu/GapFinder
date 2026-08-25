import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { continuePipelineFromSteps } from "@/lib/ai/pipeline/orchestrator";

const Body = z.object({
  steps: z.array(z.object({ order: z.number().int(), interpreted: z.string() })),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const analysis = await prisma.analysis.findFirst({ where: { id: params.id, userId } });
  if (!analysis) return NextResponse.json({ error: "Not found." }, { status: 404 });

  for (const s of parsed.data.steps) {
    await prisma.extractedStep.updateMany({
      where: { analysisId: params.id, order: s.order },
      data: { interpreted: s.interpreted, needsConfirm: false },
    });
  }

  const result = await continuePipelineFromSteps({
    analysisId: params.id,
    subject: analysis.subject,
    steps: parsed.data.steps,
  });

  return NextResponse.json(result);
}
