import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";

const Body = z.object({
  accentColor: z.enum(["purple", "pink", "orange", "teal", "blue"]).optional(),
  fontScale: z.number().min(0.8).max(1.4).optional(),
  chatBackground: z.enum(["default", "lavender", "peach", "mono"]).optional(),
  notificationsOn: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  voiceName: z.string().max(60).optional(),
  voiceSpeed: z.number().min(0.5).max(2).optional(),
  focusMusic: z.enum(["none", "lofi", "piano", "ambient"]).optional(),
  focusAmbient: z.enum(["none", "rain", "cafe", "waves"]).optional(),
  // Study preferences (separate table but exposed via same endpoint for UI simplicity)
  defaultSubject: z.enum(["Math", "Physics", "Chemistry", "Biology"]).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(180).optional(),
  difficultyBias: z.enum(["easier", "adaptive", "harder"]).optional(),
  preferredPace: z.enum(["relaxed", "standard", "intense"]).optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "That setting value isn't one we recognise." }, { status: 400 });
  }

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

  // Only the keys actually sent are written — a PATCH of one appearance field
  // must not blank out study preferences that weren't part of the request.
  const studyFields = Object.fromEntries(
    Object.entries({ defaultSubject, dailyGoalMinutes, difficultyBias, preferredPace, reminderTime }).filter(
      ([, value]) => value !== undefined
    )
  );

  const studyPreference = await prisma.studyPreference.upsert({
    where: { userId },
    create: { userId, ...studyFields },
    update: studyFields,
  });

  return NextResponse.json({ settings, studyPreference });
}
