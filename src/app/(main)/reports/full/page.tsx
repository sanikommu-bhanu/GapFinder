"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Sparkles, ScanLine, Trophy } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { cn } from "@/lib/cn";

type ReportData = {
  mastery: { conceptName: string; score: number; trend: "up" | "down" | "stable" }[];
  mastered: string[];
  improved: string[];
  recommendation: { conceptName: string | null; reason: string } | null;
  totals: {
    analyses: number;
    gapsFound: number;
    gapsRepaired: number;
    gapsTransferred: number;
    teachBacks: number;
    bestTeachBack: number;
  };
};

const TREND_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus };
const TREND_TONE = { up: "text-success", down: "text-danger", stable: "text-ink-faint" };

export default function FullReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports/full")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load your report."))))
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <div className="mx-auto h-6 w-32 animate-pulse rounded-pill bg-navy-50" />
        <div className="mt-6 h-40 animate-pulse rounded-card bg-surface-card" />
        <div className="mt-4 h-32 animate-pulse rounded-card bg-surface-card" />
      </div>
    );
  }

  const totals = data?.totals;
  const hasHistory = (totals?.analyses ?? 0) > 0;

  // Transfer rate is the number that matters: repairs can be pattern-matching,
  // transfers can't. It's computed from real attempts, never estimated.
  const transferRate =
    totals && totals.gapsFound > 0 ? Math.round((totals.gapsTransferred / totals.gapsFound) * 100) : 0;

  return (
    <div className="pb-8">
      <TopBar title="Full Report" />
      <div className="px-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {!hasHistory ? (
          <div className="mt-8 flex flex-col items-center px-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender-50">
              <Trophy className="h-7 w-7 text-lavender-500" />
            </span>
            <p className="mt-4 font-display text-base font-bold text-navy-900">Nothing to report yet</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Every number in this report comes from work you&apos;ve actually done. Analyze a problem and it starts
              filling in.
            </p>
            <Link href="/scan" className="mt-5 w-full">
              <Button className="w-full">
                <ScanLine className="h-4 w-4" /> Analyze your work
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <Card className="flex items-center gap-4">
              <ProgressRing value={transferRate} size={88} sublabel="Transfer" />
              <div className="min-w-0">
                <p className="font-display text-base font-bold leading-snug text-navy-900">Transfer rate</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
                  Of {totals!.gapsFound} gap{totals!.gapsFound === 1 ? "" : "s"} found, {totals!.gapsTransferred} came
                  back correct in a form you hadn&apos;t seen. That&apos;s the part repetition can&apos;t fake.
                </p>
              </div>
            </Card>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Analyzed", value: totals!.analyses },
                { label: "Gaps found", value: totals!.gapsFound },
                { label: "Repaired", value: totals!.gapsRepaired },
              ].map((s) => (
                <Card key={s.label} className="items-center py-3 text-center">
                  <p className="font-display text-xl font-bold text-navy-900">{s.value}</p>
                  <p className="mt-0.5 text-[10px] text-ink-soft">{s.label}</p>
                </Card>
              ))}
            </div>

            {totals!.teachBacks > 0 && (
              <Card className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-900">Best teach-back</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    Across {totals!.teachBacks} explanation{totals!.teachBacks === 1 ? "" : "s"} in your own words.
                  </p>
                </div>
                <p className="shrink-0 font-display text-2xl font-bold text-navy-900">{totals!.bestTeachBack}%</p>
              </Card>
            )}

            <p className="mt-6 text-sm font-semibold text-navy-900">Concept mastery</p>
            {data!.mastery.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No concepts tracked yet.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-3.5">
                {data!.mastery.map((m) => {
                  const Icon = TREND_ICON[m.trend] ?? Minus;
                  return (
                    <div key={m.conceptName}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm text-navy-900">{m.conceptName}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          <Icon className={cn("h-3.5 w-3.5", TREND_TONE[m.trend])} />
                          <p className="text-sm font-semibold tabular-nums text-navy-900">{m.score}%</p>
                        </div>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-surface-muted">
                        <div
                          className="h-full rounded-pill bg-gradient-brand transition-[width] duration-500"
                          style={{ width: `${Math.max(2, m.score)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {data!.mastered.length > 0 && (
              <Card className="mt-5 border border-success-50">
                <p className="text-xs font-semibold text-success">Mastered</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-900">{data!.mastered.join(", ")}</p>
              </Card>
            )}

            {data!.improved.length > 0 && (
              <Card className="mt-3">
                <p className="text-xs font-semibold text-ink-soft">Trending up</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-900">{data!.improved.join(", ")}</p>
              </Card>
            )}

            {data!.recommendation && (
              <Card className="mt-3 bg-gradient-peach shadow-none">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-peach-500" />
                  <p className="text-xs font-semibold text-navy-900">
                    Next{data!.recommendation.conceptName ? `: ${data!.recommendation.conceptName}` : ""}
                  </p>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-900">{data!.recommendation.reason}</p>
              </Card>
            )}

            <Link href="/roadmap" className="mt-5 block">
              <Button className="w-full">See my roadmap</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
