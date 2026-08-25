"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";

type Report = {
  scorePercent: number;
  mastered: string[];
  improved: string[];
  recommendations: string[];
  gapsFound: number;
  gapsRepaired: number;
  gapsTransferred: number;
};

/**
 * The close of one session: what was found, what was fixed, and what it proved.
 * Every figure is read back from the rows the session actually created.
 */
export default function SessionReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/analyses/${params.id}/report`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't build this report."))))
      .then((d) => setReport(d.report))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <div className="mx-auto h-6 w-32 animate-pulse rounded-pill bg-navy-50" />
        <div className="mx-auto mt-8 h-32 w-32 animate-pulse rounded-full bg-surface-card" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="pb-8">
        <TopBar title="Session Report" />
        <div className="px-5">
          <Card>
            <p className="text-sm text-navy-900">{error ?? "No report for this session yet."}</p>
            <Link href="/history">
              <Button variant="outline" className="mt-4 w-full">
                Back to history
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <TopBar title="Session Report" />
      <div className="flex flex-col items-center px-5">
        <ProgressRing value={report.scorePercent} size={132} />
        <p className="mt-2 text-xs font-semibold text-ink-soft">Gaps closed this session</p>

        <div className="mt-5 grid w-full grid-cols-3 gap-2">
          {[
            { label: "Found", value: report.gapsFound },
            { label: "Repaired", value: report.gapsRepaired },
            { label: "Transferred", value: report.gapsTransferred },
          ].map((s) => (
            <Card key={s.label} className="items-center py-3 text-center">
              <p className="font-display text-xl font-bold text-navy-900">{s.value}</p>
              <p className="mt-0.5 text-[10px] text-ink-soft">{s.label}</p>
            </Card>
          ))}
        </div>

        {report.mastered.length > 0 && (
          <Card className="mt-3 w-full border border-success-50">
            <p className="text-xs font-semibold text-success">What you proved you understand</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {report.mastered.map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                  <p className="text-sm text-navy-900">{m}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              Each of these came back correct in a form you hadn&apos;t seen before.
            </p>
          </Card>
        )}

        {report.improved.length > 0 && (
          <Card className="mt-3 w-full">
            <p className="text-xs font-semibold text-ink-soft">Repaired, not yet transferred</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-900">{report.improved.join(", ")}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
              You fixed the practice problem. The transfer challenge is what shows it stuck.
            </p>
          </Card>
        )}

        {report.recommendations.length > 0 && (
          <Card className="mt-3 w-full bg-gradient-peach shadow-none">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-peach-500" />
              <p className="text-xs font-semibold text-navy-900">What to do next</p>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              {report.recommendations.map((r, i) => (
                <p key={i} className="text-sm leading-relaxed text-navy-900">
                  {r}
                </p>
              ))}
            </div>
          </Card>
        )}

        <Link href="/reports/full" className="mt-5 w-full">
          <Button className="w-full">
            View full report <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/home" className="mt-2 w-full">
          <Button variant="ghost" className="w-full">
            Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
}
