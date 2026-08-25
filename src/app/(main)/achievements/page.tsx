"use client";
import { useEffect, useState } from "react";
import { Award, Target, Shuffle, MessageCircle, Flame, Trophy, Lock } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number } | null;
};

const ICONS: Record<string, typeof Target> = {
  target: Target,
  award: Award,
  shuffle: Shuffle,
  "message-circle": MessageCircle,
  flame: Flame,
};

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAchievements(d?.achievements ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="pb-8">
      <TopBar title="Achievements" />
      <div className="px-5">
        {!loading && achievements.length > 0 && (
          <p className="text-center text-[13px] text-ink-soft">
            {unlockedCount} of {achievements.length} earned — each one from work you actually did.
          </p>
        )}

        {loading ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-card bg-surface-card" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {achievements.map((a) => {
              const Icon = ICONS[a.icon] ?? Trophy;
              const pct = a.progress ? Math.round((a.progress.current / a.progress.target) * 100) : 0;
              return (
                <Card
                  key={a.id}
                  className={cn(
                    "flex flex-col items-center gap-2 text-center transition-opacity",
                    !a.unlocked && "bg-surface-muted shadow-none"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      a.unlocked ? "bg-gradient-brand" : "bg-surface"
                    )}
                  >
                    {a.unlocked ? (
                      <Icon className="h-6 w-6 text-white" />
                    ) : (
                      <Lock className="h-5 w-5 text-ink-faint" />
                    )}
                  </span>

                  <div>
                    <p className={cn("text-sm font-semibold", a.unlocked ? "text-navy-900" : "text-ink-soft")}>
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{a.description}</p>
                  </div>

                  {a.unlocked ? (
                    a.unlockedAt && (
                      <p className="mt-auto text-[10px] text-ink-faint">
                        {new Date(a.unlockedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </p>
                    )
                  ) : a.progress ? (
                    // Showing distance-to-earn turns a locked badge into a target.
                    <div className="mt-auto w-full">
                      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-navy-50">
                        <div
                          className="h-full rounded-pill bg-lavender-400 transition-[width] duration-500"
                          style={{ width: `${Math.max(3, pct)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-ink-faint">
                        {a.progress.current} / {a.progress.target}
                      </p>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
