"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/nav/TopBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type GapRow = {
  id: string;
  concept: { name: string };
  masteryScore: number;
  status: string;
};

export default function GapsPage() {
  const [overallMastery, setOverallMastery] = useState(0);
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gaps")
      .then((r) => r.json())
      .then((d) => {
        setOverallMastery(d.overallMastery ?? 0);
        setGaps(d.gaps ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const conceptRows = Object.values(
    gaps.reduce<Record<string, GapRow>>((acc, g) => {
      acc[g.concept.name] = g;
      return acc;
    }, {})
  );

  return (
    <div className="pb-6">
      <TopBar title="My Learning Gaps" back={false} />
      <div className="px-5">
        <Card className="flex items-center gap-4">
          <ProgressRing value={overallMastery} size={92} sublabel="Overall" />
          <div>
            <p className="font-display text-lg font-bold text-navy-900">Overall Understanding</p>
            <p className="text-sm text-success">Good Progress — keep going!</p>
          </div>
        </Card>

        <p className="mt-5 text-sm font-semibold text-navy-900">Concept Mastery</p>
        {loading ? (
          <p className="mt-2 text-sm text-ink-soft">Loading…</p>
        ) : conceptRows.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            No gaps yet — <Link href="/scan" className="font-semibold text-lavender-600">upload some work</Link> to get started.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            {conceptRows.map((g) => (
              <Link key={g.id} href={`/gaps/${g.id}/practice`} className="block">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-navy-900">{g.concept.name}</p>
                  <p className="text-sm font-semibold text-navy-900">{g.masteryScore}%</p>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-pill bg-surface-muted">
                  <div
                    className={cn("h-full rounded-pill bg-gradient-brand")}
                    style={{ width: `${g.masteryScore}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
