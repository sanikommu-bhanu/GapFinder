import { prisma } from "@/lib/db/prisma";

/**
 * Evaluates each achievement's criteria against real stored data and unlocks
 * any newly-earned ones. Idempotent — safe to call on every dashboard/
 * achievements page load.
 */
export async function checkAndUnlockAchievements(userId: string) {
  const [gapsFoundCount, gapsRepairedCount, transferSuccessCount, teachBackCount, profile, achievements, unlocked] =
    await Promise.all([
      prisma.gap.count({ where: { analysis: { userId } } }),
      prisma.gap.count({ where: { analysis: { userId }, status: { in: ["repaired", "closed"] } } }),
      prisma.transferAttempt.count({ where: { isCorrect: true, gap: { analysis: { userId } } } }),
      prisma.teachBackAttempt.count({ where: { gap: { analysis: { userId } } } }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.achievement.findMany(),
      prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
    ]);

  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));
  const stats = {
    gapsFound: gapsFoundCount,
    gapsRepaired: gapsRepairedCount,
    transfersSucceeded: transferSuccessCount,
    teachBacks: teachBackCount,
    streakDays: profile?.streakDays ?? 0,
  };

  for (const achievement of achievements) {
    if (unlockedIds.has(achievement.id)) continue;
    const criteria = parseCriteria(achievement.criteria);
    if (!criteria) continue;
    if ((stats[criteria.stat] ?? 0) >= criteria.min) {
      await prisma.userAchievement.create({ data: { userId, achievementId: achievement.id } }).catch(() => {});
    }
  }

  return { stats, unlocked: await prisma.userAchievement.findMany({ where: { userId } }) };
}

export type AchievementStats = {
  gapsFound: number;
  gapsRepaired: number;
  transfersSucceeded: number;
  teachBacks: number;
  streakDays: number;
};

/** A malformed criteria column should skip one badge, not break the page. */
export function parseCriteria(raw: string): { stat: keyof AchievementStats; min: number } | null {
  try {
    const parsed = JSON.parse(raw) as { stat?: string; min?: number };
    if (!parsed.stat || typeof parsed.min !== "number") return null;
    return { stat: parsed.stat as keyof AchievementStats, min: parsed.min };
  } catch {
    return null;
  }
}
