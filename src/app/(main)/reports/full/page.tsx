"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ReportData = {
  mastery: { conceptName: string; score: number; trend: string }[];
  mastered: string[];
  improved: string[];
  recommendation: { conceptName: string | null; reason: string } | null;
};

export default function FullReportPage() {
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    fetch("/api/reports/full")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div className="pb-6">
      <TopBar title="Full Report" back={false} />
      <div className="px-5">
        <Card>
          <p className="text-sm font-semibold text-navy-900">What You Mastered</p>
          <p className="mt-1 text-sm text-ink-soft">{data?.mastered.join(", ") || "Keep practicing to unlock mastered concepts."}</p>
        </Card>
        <Card className="mt-3">
          <p className="text-sm font-semibold text-navy-900">What Improved</p>
          <p className="mt-1 text-sm text-ink-soft">{data?.improved.join(", ") || "—"}</p>
        </Card>
        {data?.recommendation && (
          <Card className="mt-3 bg-gradient-peach">
            <p className="text-sm font-semibold text-navy-900">Recommendation</p>
            <p className="mt-1 text-sm text-navy-900">{data.recommendation.reason}</p>
          </Card>
        )}
        <Button className="mt-5 w-full" onClick={() => (window.location.href = "/roadmap")}>
          Next Best Step
        </Button>
      </div>
    </div>
  );
}
