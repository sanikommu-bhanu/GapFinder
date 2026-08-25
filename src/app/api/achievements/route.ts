import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { checkAndUnlockAchievements } from "@/lib/services/achievements-service";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  await checkAndUnlockAchievements(userId);

  const [all, unlocked] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);
  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

  return NextResponse.json({
    achievements: all.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: a.description,
      icon: a.icon,
      unlocked: unlockedIds.has(a.id),
      unlockedAt: unlocked.find((u) => u.achievementId === a.id)?.unlockedAt ?? null,
    })),
  });
}
