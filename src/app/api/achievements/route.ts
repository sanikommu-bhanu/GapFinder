import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { checkAndUnlockAchievements, parseCriteria } from "@/lib/services/achievements-service";

/**
 * Achievements are evaluated against real stored evidence on every read, so a
 * badge appears the moment it is genuinely earned. Locked badges report how far
 * along the student is, which turns a grey box into a next step.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { stats } = await checkAndUnlockAchievements(userId);

  const [all, unlocked] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);
  const unlockedById = new Map(unlocked.map((u) => [u.achievementId, u]));

  return NextResponse.json({
    achievements: all.map((a) => {
      const criteria = parseCriteria(a.criteria);
      const current = criteria ? (stats[criteria.stat] ?? 0) : 0;
      return {
        id: a.id,
        slug: a.slug,
        title: a.title,
        description: a.description,
        icon: a.icon,
        unlocked: unlockedById.has(a.id),
        unlockedAt: unlockedById.get(a.id)?.unlockedAt ?? null,
        progress: criteria ? { current: Math.min(current, criteria.min), target: criteria.min } : null,
      };
    }),
  });
}
