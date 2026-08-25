"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Star, RotateCcw, ArrowRight, TrendingUp } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkInput } from "@/components/ui/WorkInput";
import { SourceBadge } from "@/components/ui/SourceBadge";

type Problem = { id: string; prompt: string; difficulty: string };
type Result = {
  isCorrect: boolean;
  feedback: string;
  firstErrorLine?: number | null;
};

export default function TransferPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [conceptName, setConceptName] = useState<string | null>(null);
  const [source, setSource] = useState<"gemini" | "deterministic" | null>(null);
  const [steps, setSteps] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [mastery, setMastery] = useState<{ before: number; after: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSteps("");
    try {
      const res = await fetch(`/api/gaps/${params.id}/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "transfer" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't prepare a transfer problem.");
      setProblem(d.problem);
      setConceptName(d.concept?.name ?? null);
      setSource(d.source ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't prepare a transfer problem.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function checkWork() {
    if (!problem) return;
    if (!steps.trim()) {
      setError("Write your working first — one equation per line.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/transfer-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gapId: params.id, problemId: problem.id, studentSteps: steps }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't check your work.");
      setResult(data.validation);
      if (typeof data.masteryScore === "number") {
        setMastery({ before: data.previousMasteryScore ?? data.masteryScore, after: data.masteryScore });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check your work.");
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <div className="h-6 w-44 animate-pulse rounded-pill bg-navy-50" />
        <div className="mt-6 h-24 animate-pulse rounded-card bg-white" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (error && !problem) {
    return (
      <div className="pb-8">
        <TopBar title="Transfer" />
        <div className="px-5">
          <Card>
            <p className="text-sm leading-relaxed text-navy-900">{error}</p>
            <Button onClick={load} className="mt-4 w-full">
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (result?.isCorrect) {
    return (
      <div className="pb-8">
        <TopBar title="Transfer Verified" back={false} />
        <div className="flex flex-col items-center px-5 pt-6">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-brand shadow-floating animate-pop-in">
            <Star className="h-11 w-11 text-white" />
          </span>
          <h2 className="mt-6 text-center font-display text-xl font-bold leading-snug text-navy-900">
            You applied the same idea in a new shape.
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">
            That&apos;s the difference between remembering a procedure and understanding it.
          </p>

          {mastery && (
            <Card className="mt-6 w-full text-center">
              <p className="text-xs font-semibold text-ink-soft">{conceptName ?? "This concept"}</p>
              <p className="mt-0.5 text-sm font-semibold text-navy-900">Mastery updated</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                {mastery.before !== mastery.after && (
                  <>
                    <span className="font-display text-lg text-ink-faint">{mastery.before}%</span>
                    <TrendingUp className="h-4 w-4 text-success" />
                  </>
                )}
                <span className="font-display text-3xl font-bold text-navy-900">{mastery.after}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-surface-muted">
                <div
                  className="h-full rounded-pill bg-gradient-brand transition-[width] duration-700"
                  style={{ width: `${mastery.after}%` }}
                />
              </div>
            </Card>
          )}

          <Button className="mt-6 w-full" onClick={() => router.push(`/gaps/${params.id}/teach-back`)}>
            Now teach it back <ArrowRight className="h-4 w-4" />
          </Button>
          <Link href="/gaps" className="mt-2 w-full">
            <Button variant="ghost" className="w-full">
              View my progress
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <TopBar title="Transfer Problem" />
      <div className="px-5">
        <p className="text-center text-[13px] leading-relaxed text-ink-soft">
          Same idea, different shape. This is the one that proves you understood it.
        </p>

        {problem && (
          <Card className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink-soft">Solve for the variable</p>
              {source && <SourceBadge source={source} />}
            </div>
            <p className="mt-1.5 font-display text-2xl font-bold text-navy-900">{problem.prompt}</p>
          </Card>
        )}

        {result && !result.isCorrect && (
          <div className="mt-3 rounded-2xl bg-danger-50 p-3.5">
            <p className="text-xs font-semibold text-danger">
              {result.firstErrorLine ? `First problem on line ${result.firstErrorLine}` : "Not quite"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-navy-900">{result.feedback}</p>
            <p className="mt-2 text-[11px] text-ink-soft">
              Missing a transfer usually means the repair didn&apos;t fully land. That&apos;s useful information, not a
              failure.
            </p>
          </div>
        )}

        <WorkInput
          className="mt-4"
          label="Your working"
          value={steps}
          onChange={setSteps}
          errorLine={result?.firstErrorLine}
          placeholder={"Write one step per line, e.g.\n3n = 18\nn = 6"}
        />

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button onClick={checkWork} loading={checking} className="mt-4 w-full">
          Check Answer
        </Button>
      </div>
    </div>
  );
}
