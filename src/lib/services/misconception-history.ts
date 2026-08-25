import { prisma } from "@/lib/db/prisma";
import { getMisconception, type Misconception } from "@/lib/diagnosis/misconceptions";

/**
 * The learner's misconception fingerprint, and what it predicts.
 *
 * Because every diagnosis resolves to a stable code from a closed catalogue —
 * and most of them are *proved* by an algebraic signature rather than named by
 * a model — the codes are countable. The same slip on Tuesday and Friday
 * produces the same code, which means a pattern can be measured instead of
 * described.
 *
 * That makes a genuinely new move possible: GapFinder can say, before the
 * student starts, which mistake it expects them to make. Then it checks.
 *
 * Two outcomes, and the second is the point:
 *   - The prediction lands → the pattern is real and now named out loud.
 *   - The prediction FAILS → the student broke a habit, and there is hard
 *     evidence for it. That is the strongest thing this product can show
 *     anyone, and it is only possible because the prediction was made first.
 *
 * Every number here comes from rows the student's own work created. Nothing is
 * estimated, and a learner with no history gets no prediction rather than a
 * plausible-looking guess.
 */

/** A prediction needs at least this many sightings to be worth stating. */
const MIN_OCCURRENCES = 2;
/** Recent errors say more about now than old ones. Half-life in days. */
const HALF_LIFE_DAYS = 14;

export interface MisconceptionStat {
  code: string;
  misconception: Misconception;
  /** How many times this exact code has been diagnosed. */
  occurrences: number;
  /** How many were proved by algebraic signature rather than model-matched. */
  proved: number;
  firstSeen: Date;
  lastSeen: Date;
  /** Recency-weighted share of this learner's errors, 0-1. */
  weight: number;
  /** True when it has appeared, then not recurred since being repaired. */
  dormant: boolean;
  /** Occurrences that ended in a closed (transferred) gap. */
  overcome: number;
}

export interface MisconceptionPrediction {
  code: string;
  misconception: Misconception;
  /** Recency-weighted share, expressed 0-100 for display. */
  likelihood: number;
  occurrences: number;
  /** Plain-language justification, built from counts rather than adjectives. */
  because: string;
}

export interface MisconceptionProfile {
  stats: MisconceptionStat[];
  /** The mistake most likely to appear next, or null when there isn't evidence. */
  prediction: MisconceptionPrediction | null;
  totalDiagnoses: number;
  /** Codes seen before that have since stopped recurring. */
  brokenHabits: MisconceptionStat[];
}

function recencyWeight(lastSeen: Date): number {
  const ageDays = (Date.now() - lastSeen.getTime()) / 86_400_000;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export async function getMisconceptionProfile(
  userId: string,
  options: { subject?: string } = {}
): Promise<MisconceptionProfile> {
  const gaps = await prisma.gap.findMany({
    where: {
      analysis: { userId, ...(options.subject ? { subject: options.subject } : {}) },
      misconceptionCode: { not: null },
    },
    select: {
      misconceptionCode: true,
      misconceptionBasis: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (gaps.length === 0) {
    return { stats: [], prediction: null, totalDiagnoses: 0, brokenHabits: [] };
  }

  const byCode = new Map<string, MisconceptionStat>();
  for (const gap of gaps) {
    const code = gap.misconceptionCode!;
    if (code === "UNCLASSIFIED") continue;

    const existing = byCode.get(code);
    if (existing) {
      existing.occurrences += 1;
      if (gap.misconceptionBasis === "proved") existing.proved += 1;
      if (gap.status === "closed") existing.overcome += 1;
      existing.lastSeen = gap.createdAt;
    } else {
      byCode.set(code, {
        code,
        misconception: getMisconception(code),
        occurrences: 1,
        proved: gap.misconceptionBasis === "proved" ? 1 : 0,
        firstSeen: gap.createdAt,
        lastSeen: gap.createdAt,
        weight: 0,
        dormant: false,
        overcome: gap.status === "closed" ? 1 : 0,
      });
    }
  }

  const stats = Array.from(byCode.values());
  const rawWeights = stats.map((s) => s.occurrences * recencyWeight(s.lastSeen));
  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0) || 1;

  stats.forEach((stat, i) => {
    stat.weight = rawWeights[i]! / totalWeight;
    // Seen more than once, every instance since transferred, and quiet lately.
    stat.dormant =
      stat.occurrences >= MIN_OCCURRENCES &&
      stat.overcome === stat.occurrences &&
      recencyWeight(stat.lastSeen) < 0.5;
  });

  stats.sort((a, b) => b.weight - a.weight);

  const candidate = stats.find((s) => s.occurrences >= MIN_OCCURRENCES && !s.dormant);

  return {
    stats,
    totalDiagnoses: gaps.length,
    brokenHabits: stats.filter((s) => s.dormant),
    prediction: candidate
      ? {
          code: candidate.code,
          misconception: candidate.misconception,
          likelihood: Math.round(candidate.weight * 100),
          occurrences: candidate.occurrences,
          because: buildJustification(candidate, gaps.length),
        }
      : null,
  };
}

function buildJustification(stat: MisconceptionStat, totalDiagnoses: number): string {
  const provedPart =
    stat.proved === stat.occurrences
      ? "every one confirmed by the algebra itself"
      : `${stat.proved} of them confirmed by the algebra itself`;
  return `This exact slip accounts for ${stat.occurrences} of your ${totalDiagnoses} diagnosed errors — ${provedPart}.`;
}

/**
 * Checks a finished attempt against what was predicted.
 *
 * Called after the student submits, so the verdict is about what they actually
 * did rather than what they were expected to do. "Broke the pattern" is only
 * reported when a genuine prediction existed to break.
 */
export function evaluatePrediction(params: {
  predictedCode: string | null;
  actualCode: string | null;
  wasCorrect: boolean;
}): { outcome: "broke-pattern" | "repeated" | "different-slip" | "none"; message: string } {
  const { predictedCode, actualCode, wasCorrect } = params;

  if (!predictedCode) return { outcome: "none", message: "" };

  if (wasCorrect) {
    return {
      outcome: "broke-pattern",
      message: "We expected this exact slip and it didn't happen. That's the habit broken, on the record.",
    };
  }

  if (actualCode && actualCode === predictedCode) {
    return {
      outcome: "repeated",
      message:
        "That's the slip we flagged before you started — which means it's a rule you're applying, not a moment of carelessness.",
    };
  }

  return {
    outcome: "different-slip",
    message: "Not the mistake we expected. This one is new, so it gets its own diagnosis.",
  };
}
