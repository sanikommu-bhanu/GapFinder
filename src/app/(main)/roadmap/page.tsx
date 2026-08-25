"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Node = {
  conceptId: string;
  slug: string;
  name: string;
  masteryScore: number;
  trend: "up" | "down" | "stable";
  status: "mastered" | "active" | "locked";
  prerequisites: string[];
};

type Recommendation = {
  conceptId: string;
  conceptName: string | null;
  reason: string;
  priority: number;
};

export default function RoadmapPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The API picks the subject the student last worked in when none is asked
    // for, so the roadmap opens on something relevant.
    const query = activeSubject ? `?subject=${encodeURIComponent(activeSubject)}` : "";
    setLoading(true);
    fetch(`/api/roadmap${query}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load your roadmap."))))
      .then((d) => {
        setNodes(d.nodes ?? []);
        setRecommendation(d.recommendation ?? null);
        setSubjects(d.availableSubjects ?? []);
        setActiveSubject((current) => current ?? d.activeSubject ?? null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeSubject]);

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <div className="h-6 w-40 animate-pulse rounded-pill bg-navy-50" />
        <div className="mt-5 flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <TopBar title="Learning Roadmap" />
      <div className="px-5">
        <p className="text-center text-[13px] text-ink-soft">
          Ordered by what your own work showed, not by a syllabus.
        </p>

        {subjects.length > 1 && (
          <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 scrollbar-none">
            {subjects.map((subject) => (
              <Chip
                key={subject}
                active={activeSubject === subject}
                onClick={() => setActiveSubject(subject)}
                className="shrink-0"
              >
                {subject}
              </Chip>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {!loading && nodes.length === 0 && (
          <Card className="mt-4 bg-surface-muted shadow-none">
            <p className="text-sm leading-relaxed text-ink-soft">
              No concepts mapped for {activeSubject} yet. Analyze some work in this subject and the path fills in.
            </p>
          </Card>
        )}

        <div className="relative mt-5">
          {/* The spine connecting the path. */}
          <span aria-hidden="true" className="absolute bottom-6 left-[11px] top-6 w-0.5 bg-navy-50" />

          <ol className="flex flex-col gap-3">
            {nodes.map((n) => {
              const recommended = recommendation?.conceptId === n.conceptId;
              return (
                <li key={n.conceptId} className="relative flex items-center gap-3">
                  <span
                    className={cn(
                      "z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-surface-muted",
                      n.status === "mastered"
                        ? "border-success bg-success"
                        : n.status === "active"
                          ? "border-lavender-500 bg-white"
                          : "border-navy-50 bg-white"
                    )}
                  >
                    {n.status === "mastered" ? (
                      <Check className="h-3.5 w-3.5 text-white" />
                    ) : n.status === "locked" ? (
                      <Lock className="h-3 w-3 text-ink-faint" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-lavender-500" />
                    )}
                  </span>

                  <Card
                    className={cn(
                      "flex flex-1 items-center justify-between gap-2 py-3",
                      n.status === "locked" && "bg-surface-muted opacity-70 shadow-none",
                      recommended && "border border-lavender-300 bg-lavender-50"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-navy-900">{n.name}</p>
                        {recommended && (
                          <span className="shrink-0 rounded-pill bg-lavender-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Next
                          </span>
                        )}
                      </div>
                      {n.status === "locked" && n.prerequisites.length > 0 && (
                        <p className="mt-0.5 truncate text-[10px] text-ink-faint">
                          Unlocks after {n.prerequisites.join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {n.trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-success" />}
                      {n.trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-danger" />}
                      <p className="text-sm font-semibold tabular-nums text-ink-soft">{n.masteryScore}%</p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        </div>

        {recommendation ? (
          <Card className="mt-6 bg-gradient-peach shadow-none">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-peach-500" />
              <p className="text-xs font-semibold text-navy-900">
                Next best step{recommendation.conceptName ? `: ${recommendation.conceptName}` : ""}
              </p>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-navy-900">{recommendation.reason}</p>
          </Card>
        ) : (
          <Card className="mt-6 bg-surface-muted shadow-none">
            <p className="text-sm leading-relaxed text-ink-soft">
              Analyze some work and this fills in with a path built from what actually broke.
            </p>
          </Card>
        )}

        <Button className="mt-5 w-full" onClick={() => router.push("/gaps")}>
          Work on my gaps
        </Button>
      </div>
    </div>
  );
}
