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
    const criteria = JSON.parse(achievement.criteria) as { stat: keyof typeof stats; min: number };
    if ((stats[criteria.stat] ?? 0) >= criteria.min) {
      await prisma.userAchievement.create({ data: { userId, achievementId: achievement.id } }).catch(() => {});
    }
  }

  return prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } });
}
