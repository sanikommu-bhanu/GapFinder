import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

const Body = z.object({
  subjects: z.array(z.string()).min(1),
  gradeLevel: z.string(),
});

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      subjects: JSON.stringify(parsed.data.subjects),
      gradeLevel: parsed.data.gradeLevel,
    },
    update: {
      subjects: JSON.stringify(parsed.data.subjects),
      gradeLevel: parsed.data.gradeLevel,
    },
  });

  await prisma.studyPreference.update({
    where: { userId },
    data: { defaultSubject: parsed.data.subjects[0] },
  });

  return NextResponse.json({ profile });
}
