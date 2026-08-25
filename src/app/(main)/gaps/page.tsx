"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ScanLine, Target } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type GapRow = {
  id: string;
  concept: { id: string; name: string; slug: string };
  underlyingGap: string;
  masteryScore: number;
  status: "open" | "repaired" | "closed";
  createdAt: string;
};

function masteryTone(score: number): string {
  if (score >= 85) return "text-success";
  if (score >= 60) return "text-navy-900";
  return "text-warning";
}

function overallLabel(score: number, hasData: boolean): { title: string; tone: string } {
  if (!hasData) return { title: "No data yet", tone: "text-ink-soft" };
  if (score >= 85) return { title: "Strong — keep it up", tone: "text-success" };
  if (score >= 60) return { title: "Good progress — keep going", tone: "text-success" };
  if (score >= 35) return { title: "Building — worth the reps", tone: "text-warning" };
  return { title: "Early days — start with one gap", tone: "text-warning" };
}

export default function GapsPage() {
  const [overallMastery, setOverallMastery] = useState(0);
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/gaps")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load your gaps."))))
      .then((d) => {
        setOverallMastery(d.overallMastery ?? 0);
        setGaps(d.gaps ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // One row per concept, keeping the most recent still-open gap as the entry point.
  const byConcept = new Map<string, GapRow>();
  for (const g of gaps) {
    const existing = byConcept.get(g.concept.slug);
    if (!existing) byConcept.set(g.concept.slug, g);
    else if (existing.status !== "open" && g.status === "open") byConcept.set(g.concept.slug, g);
  }
  const conceptRows = Array.from(byConcept.values()).sort((a, b) => a.masteryScore - b.masteryScore);
  const openCount = gaps.filter((g) => g.status === "open").length;
  const label = overallLabel(overallMastery, conceptRows.length > 0);

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <div className="h-6 w-40 animate-pulse rounded-pill bg-navy-50" />
        <div className="mt-5 h-32 animate-pulse rounded-card bg-white" />
        <div className="mt-5 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <TopBar title="My Learning Gaps" back={false} />
      <div className="px-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Card className="flex items-center gap-4">
          <ProgressRing value={overallMastery} size={88} sublabel="Overall" />
          <div className="min-w-0">
            <p className="font-display text-base font-bold leading-snug text-navy-900">Overall understanding</p>
            <p className={cn("mt-0.5 text-sm font-medium", label.tone)}>{label.title}</p>
            {conceptRows.length > 0 && (
              <p className="mt-1 text-[11px] text-ink-soft">
                {openCount} open · {conceptRows.length} concept{conceptRows.length === 1 ? "" : "s"} tracked
              </p>
            )}
          </div>
        </Card>

        {conceptRows.length === 0 ? (
          <div className="mt-8 flex flex-col items-center px-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender-50">
              <Target className="h-7 w-7 text-lavender-500" />
            </span>
            <p className="mt-4 font-display text-base font-bold text-navy-900">Nothing to fix yet</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Upload a problem you worked through and we&apos;ll find the exact step where your reasoning changed.
            </p>
            <Link
              href="/scan"
              className="mt-5 flex h-12 items-center gap-2 rounded-pill bg-navy-900 px-6 font-display text-sm font-semibold text-on-strong"
            >
              <ScanLine className="h-4 w-4" /> Analyze your work
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm font-semibold text-navy-900">Concept mastery</p>
            <div className="mt-3 flex flex-col gap-4">
              {conceptRows.map((g) => (
                <Link key={g.id} href={`/gaps/${g.id}/practice`} className="block active:opacity-70">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm text-navy-900">{g.concept.name}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {g.status === "open" && (
                        <span className="rounded-pill bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning">
                          Open
                        </span>
                      )}
                      {g.status === "closed" && (
                        <span className="rounded-pill bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success">
                          Transferred
                        </span>
                      )}
                      <p className={cn("text-sm font-semibold tabular-nums", masteryTone(g.masteryScore))}>
                        {g.masteryScore}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-surface-muted">
                    <div
                      className="h-full rounded-pill bg-gradient-brand transition-[width] duration-500"
                      style={{ width: `${Math.max(2, g.masteryScore)}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>

            <Link href="/roadmap" className="mt-6 block">
              <Card className="flex items-center gap-3 bg-gradient-lavender shadow-none active:scale-[0.99]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy-900">See your roadmap</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    What to learn next, ordered by what actually broke.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-navy-900" />
              </Card>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
