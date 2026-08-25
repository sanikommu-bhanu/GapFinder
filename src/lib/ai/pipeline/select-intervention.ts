export type Difficulty = "warmup" | "repair" | "challenge" | "transfer" | "mastery";

/**
 * Deterministically chooses intervention difficulty from evidence rather than
 * always giving the same level. This runs BEFORE practice generation so the
 * generation prompt is told what to build, instead of asking the LLM to also
 * decide difficulty (keeping each stage single-purpose and debuggable).
 */
export function selectDifficulty(params: {
  currentMasteryScore: number; // 0-100
  recentAttempts: { isCorrect: boolean }[]; // most recent last
  isFirstEncounter: boolean;
}): Difficulty {
  if (params.isFirstEncounter) return "repair";

  const last3 = params.recentAttempts.slice(-3);
  const recentCorrectRate = last3.length
    ? last3.filter((a) => a.isCorrect).length / last3.length
    : 0;

  if (params.currentMasteryScore < 40 || recentCorrectRate < 0.34) return "repair";
  if (params.currentMasteryScore < 70 || recentCorrectRate < 0.67) return "challenge";
  if (params.currentMasteryScore < 90) return "transfer";
  return "mastery";
}
