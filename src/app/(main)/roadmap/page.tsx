"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Node = { conceptId: string; slug: string; name: string; masteryScore: number; status: string };

export default function RoadmapPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [recommendation, setRecommendation] = useState<{ conceptId: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/roadmap")
      .then((r) => r.json())
      .then((d) => {
        setNodes(d.nodes ?? []);
        setRecommendation(d.recommendation ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-6">
      <TopBar title="Learning Roadmap" subtitle="Your personalized path" back={false} />
      <div className="px-5">
        {loading ? (
          <p className="text-sm text-ink-soft">Loading your roadmap…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {nodes.map((n) => (
              <div key={n.conceptId} className="flex items-center gap-3">
                {n.status === "mastered" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                ) : n.status === "active" ? (
                  <Circle className="h-5 w-5 shrink-0 text-lavender-500" />
                ) : (
                  <Lock className="h-5 w-5 shrink-0 text-ink-faint" />
                )}
                <Card className={cn("flex-1 flex-row items-center justify-between py-3", n.status === "locked" && "opacity-50")}>
                  <p className="text-sm font-medium text-navy-900">{n.name}</p>
                  <p className="text-sm font-semibold text-ink-soft">{n.masteryScore}%</p>
                </Card>
              </div>
            ))}
          </div>
        )}

        {recommendation && (
          <Card className="mt-5 bg-gradient-peach">
            <p className="text-xs font-semibold text-navy-900">Recommended next</p>
            <p className="mt-1 text-sm text-navy-900">{recommendation.reason}</p>
          </Card>
        )}

        <Button className="mt-5 w-full" onClick={() => (window.location.href = "/gaps")}>
          View Next Step
        </Button>
      </div>
    </div>
  );
}
