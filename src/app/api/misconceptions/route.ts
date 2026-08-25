import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getMisconceptionProfile } from "@/lib/services/misconception-history";

/**
 * The learner's misconception fingerprint and the prediction that follows from
 * it. Read-only, computed from diagnosed gaps — a learner with no history gets
 * an empty profile and no prediction rather than an invented one.
 */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const subject = req.nextUrl.searchParams.get("subject") ?? undefined;
  const profile = await getMisconceptionProfile(userId, { subject });

  return NextResponse.json({
    totalDiagnoses: profile.totalDiagnoses,
    prediction: profile.prediction
      ? {
          code: profile.prediction.code,
          name: profile.prediction.misconception.name,
          studentRule: profile.prediction.misconception.studentRule,
          socraticPrompt: profile.prediction.misconception.socraticPrompt,
          likelihood: profile.prediction.likelihood,
          occurrences: profile.prediction.occurrences,
          because: profile.prediction.because,
        }
      : null,
    stats: profile.stats.map((s) => ({
      code: s.code,
      name: s.misconception.name,
      subject: s.misconception.subject,
      occurrences: s.occurrences,
      proved: s.proved,
      overcome: s.overcome,
      dormant: s.dormant,
      share: Math.round(s.weight * 100),
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen,
    })),
    brokenHabits: profile.brokenHabits.map((s) => ({
      code: s.code,
      name: s.misconception.name,
      occurrences: s.occurrences,
      lastSeen: s.lastSeen,
    })),
  });
}
