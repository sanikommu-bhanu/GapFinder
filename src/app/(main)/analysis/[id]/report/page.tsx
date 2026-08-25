"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/nav/TopBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Report = { scorePercent: number; mastered: string[]; improved: string[]; recommendations: string[] };

export default function SessionReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [gapsFound, setGapsFound] = useState(0);

  useEffect(() => {
    fetch(`/api/analyses/${params.id}/report`)
      .then((r) => r.json())
      .then((d) => setReport(d.report))
      .catch(() => {});
    fetch(`/api/analyses/${params.id}`)
      .then((r) => r.json())
      .then((d) => setGapsFound(d.analysis?.gaps?.length ?? 0));
  }, [params.id]);

  return (
    <div className="pb-6">
      <TopBar title="Session Report" subtitle={new Date().toLocaleDateString()} back={false} />
      <div className="flex flex-col items-center px-5">
        <ProgressRing value={report?.scorePercent ?? 0} size={150} />

        <div className="mt-6 grid w-full grid-cols-3 gap-2 text-center">
          <Card className="py-3">
            <p className="text-lg font-bold text-navy-900">{gapsFound}</p>
            <p className="text-[11px] text-ink-soft">Gaps Found</p>
          </Card>
          <Card className="py-3">
            <p className="text-lg font-bold text-navy-900">{report?.improved.length ?? 0}</p>
            <p className="text-[11px] text-ink-soft">Repaired</p>
          </Card>
          <Card className="py-3">
            <p className="text-lg font-bold text-navy-900">{report?.mastered.length ?? 0}</p>
            <p className="text-[11px] text-ink-soft">Transferred</p>
          </Card>
        </div>

        <Button className="mt-6 w-full" onClick={() => router.push("/reports/full")}>
          View Full Report
        </Button>
      </div>
    </div>
  );
}
