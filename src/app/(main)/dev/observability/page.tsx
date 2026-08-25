"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { cn } from "@/lib/cn";
import { AlertTriangle, ChevronRight, Zap } from "lucide-react";

type Row = {
  id: string;
  subject: string;
  status: string;
  confidence: string | null;
  isDemo: boolean;
  createdAt: string;
  gapCount: number;
  callCount: number;
  errorCount: number;
  avgLatencyMs: number | null;
};

const STATUS_COLOR: Record<string, string> = {
  complete: "text-success",
  failed: "text-danger",
  needs_confirmation: "text-warning",
  pending: "text-ink-soft",
  reading: "text-ink-soft",
  reconstructing: "text-ink-soft",
  verifying: "text-ink-soft",
};

export default function ObservabilityListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dev/observability")
      .then((r) => r.json())
      .then((d) => setRows(d.analyses ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-6">
      <TopBar title="AI Observability" subtitle="Debug the pipeline, run by run" />
      <div className="px-5">
        <Card className="mb-3 border border-lavender-200 bg-lavender-50">
          <p className="text-xs text-ink-soft">
            Every row below is a real persisted analysis. Tap one to see input → extraction → reasoning →
            first divergence → gap → retrieved knowledge → generated intervention → practice/transfer →
            latency and errors for every AI call it made.
          </p>
        </Card>

        {loading && <p className="py-8 text-center text-sm text-ink-soft">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-soft">No analyses yet.</p>
        )}

        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <Link key={r.id} href={`/dev/observability/${r.id}`}>
              <Card className="flex flex-row items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-navy-900">
                      {r.subject} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                    {r.isDemo && (
                      <span className="rounded-pill bg-navy-50 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                        DEMO
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-0.5 text-xs font-semibold capitalize", STATUS_COLOR[r.status] ?? "text-ink-soft")}>
                    {r.status.replace(/_/g, " ")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {r.confidence && <ConfidenceBadge level={r.confidence as "high" | "medium" | "low"} />}
                    <span className="text-xs text-ink-soft">{r.gapCount} gap{r.gapCount === 1 ? "" : "s"}</span>
                    <span className="flex items-center gap-1 text-xs text-ink-soft">
                      <Zap className="h-3 w-3" /> {r.callCount} calls
                      {r.avgLatencyMs !== null && ` · avg ${r.avgLatencyMs}ms`}
                    </span>
                    {r.errorCount > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-danger">
                        <AlertTriangle className="h-3 w-3" /> {r.errorCount} error{r.errorCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
