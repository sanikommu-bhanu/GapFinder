"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Mirrors the stage sequence the orchestrator writes to `analysis.status`.
 * The bar moves because work finished, not because time passed.
 */
const STAGES: { key: string; label: string; detail: string }[] = [
  { key: "reading", label: "Reading your handwriting", detail: "Multimodal pass over the photo" },
  { key: "reconstructing", label: "Reconstructing your reasoning", detail: "Turning marks into claims" },
  { key: "verifying", label: "Verifying every step", detail: "Algebraic check, not a guess" },
  { key: "classifying", label: "Finding the first gap", detail: "Matching it to a concept" },
  { key: "explaining", label: "Explaining why", detail: "Grounding in your knowledge base" },
];

const POLL_MS = 900;

function AnalyzingView() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  const [status, setStatus] = useState<string>("pending");
  const [statusReason, setStatusReason] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [pollFailures, setPollFailures] = useState(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!id) return;
    cancelled.current = false;

    async function poll() {
      try {
        const res = await fetch(`/api/analyses/${id}/status`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled.current) {
            setStatus("failed");
            setStatusReason("We couldn't find that analysis. It may have been removed.");
          }
          return;
        }
        if (!res.ok) throw new Error("status unavailable");
        const data = await res.json();
        if (cancelled.current) return;

        setPollFailures(0);
        setStatus(data.status);
        setStatusReason(data.statusReason ?? null);
        setStageIndex(data.stageIndex ?? 0);

        if (data.status === "complete") {
          router.replace(`/analysis/${id}`);
          return;
        }
        if (data.status === "needs_confirmation") {
          router.replace(`/analysis/${id}/confirm`);
          return;
        }
        if (data.status === "failed") return;
      } catch {
        if (cancelled.current) return;
        // Transient network blips shouldn't kill the screen; sustained ones should.
        setPollFailures((n) => n + 1);
      }
      if (!cancelled.current) setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled.current = true;
    };
  }, [id, router]);

  if (!id) {
    return (
      <div className="pb-6">
        <TopBar title="Analyzing" back={false} />
        <div className="px-5">
          <Card>
            <p className="text-sm text-navy-900">No analysis was specified.</p>
            <Link href="/scan">
              <Button className="mt-4 w-full">Upload your work</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const failed = status === "failed" || pollFailures > 8;

  if (failed) {
    return (
      <div className="pb-6">
        <TopBar title="We hit a problem" back={false} />
        <div className="flex flex-col items-center px-5 pt-6">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
            <AlertTriangle className="h-7 w-7 text-danger" />
          </span>
          <p className="mt-5 text-center text-sm leading-relaxed text-ink-soft">
            {statusReason ??
              "We lost the connection while analyzing your work. Your photo is safe — try starting the analysis again."}
          </p>
          <Link href="/scan" className="mt-7 w-full">
            <Button className="w-full">Try another photo</Button>
          </Link>
          <Link href="/home" className="mt-3 w-full">
            <Button variant="outline" className="w-full">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // `stageIndex` is 0 while pending; the first stage is index 1.
  const completed = Math.max(0, stageIndex - 1);
  const percent = Math.round((completed / STAGES.length) * 100);

  return (
    <div className="pb-6">
      <TopBar title="Analyzing your work…" back={false} />
      <div className="flex flex-col items-center px-5">
        <p className="text-center text-[13px] text-ink-soft">This usually takes 5–15 seconds.</p>

        <div className="mt-5">
          <ProgressRing value={percent} size={140} colorFrom="#C3B4F7" colorTo="#FFB27A" />
        </div>

        <div
          className="mt-7 flex w-full flex-col gap-2.5"
          role="status"
          aria-live="polite"
          aria-label={`Stage ${completed + 1} of ${STAGES.length}: ${STAGES[Math.min(completed, STAGES.length - 1)]!.label}`}
        >
          {STAGES.map((s, i) => {
            const done = i < completed;
            const active = i === completed;
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 rounded-2xl p-3 transition-colors ${
                  active ? "bg-white shadow-card" : "bg-white/60"
                }`}
              >
                {done ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success">
                    <Check className="h-4 w-4 text-white" />
                  </span>
                ) : active ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender-100">
                    <Loader2 className="h-4 w-4 animate-spin text-lavender-600" />
                  </span>
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded-full border-2 border-navy-50" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm ${done || active ? "text-navy-900" : "text-ink-faint"}`}>{s.label}</p>
                  {active && <p className="text-[11px] text-ink-soft">{s.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {pollFailures > 2 && (
          <p className="mt-4 text-center text-xs text-ink-faint">
            Reconnecting… ({pollFailures} attempts)
          </p>
        )}
      </div>
    </div>
  );
}

export default function AnalyzingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-ink-soft">Starting analysis…</div>
      }
    >
      <AnalyzingView />
    </Suspense>
  );
}
