import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

const Body = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  accentColor: z.string().optional(),
  fontScale: z.number().min(0.8).max(1.4).optional(),
  chatBackground: z.string().optional(),
  notificationsOn: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  voiceName: z.string().optional(),
  voiceSpeed: z.number().min(0.5).max(2).optional(),
  focusMusic: z.string().optional(),
  focusAmbient: z.string().optional(),
  // Study preferences (separate table but exposed via same endpoint for UI simplicity)
  defaultSubject: z.string().optional(),
  dailyGoalMinutes: z.number().int().min(5).max(180).optional(),
  difficultyBias: z.enum(["easier", "adaptive", "harder"]).optional(),
  preferredPace: z.enum(["relaxed", "standard", "intense"]).optional(),
  reminderTime: z.string().nullable().optional(),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [settings, studyPreference] = await Promise.all([
    prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.studyPreference.upsert({ where: { userId }, create: { userId }, update: {} }),
  ]);

  return NextResponse.json({ settings, studyPreference });
}

export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const {
    defaultSubject,
    dailyGoalMinutes,
    difficultyBias,
    preferredPace,
    reminderTime,
    ...settingsFields
  } = parsed.data;

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...settingsFields },
    update: settingsFields,
  });

  const studyPreference = await prisma.studyPreference.upsert({
    where: { userId },
    create: { userId, defaultSubject, dailyGoalMinutes, difficultyBias, preferredPace, reminderTime },
    update: { defaultSubject, dailyGoalMinutes, difficultyBias, preferredPace, reminderTime },
  });

  return NextResponse.json({ settings, studyPreference });
}
