"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, RotateCcw, ArrowRight } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkInput } from "@/components/ui/WorkInput";
import { SourceBadge } from "@/components/ui/SourceBadge";

type Problem = { id: string; prompt: string; difficulty: string };
type Result = {
  isCorrect: boolean;
  feedback: string;
  verifiedBy: string;
  firstErrorLine?: number | null;
  correctedExpression?: string | null;
};

export default function PracticePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [conceptName, setConceptName] = useState<string | null>(null);
  const [source, setSource] = useState<"gemini" | "deterministic" | null>(null);
  const [steps, setSteps] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [attempts, setAttempts] = useState(0);
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
        body: JSON.stringify({ mode: "repair" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't prepare a practice problem.");
      setProblem(d.problem);
      setConceptName(d.concept?.name ?? null);
      setSource(d.source ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't prepare a practice problem.");
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
      const res = await fetch("/api/practice-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gapId: params.id, problemId: problem.id, studentSteps: steps }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't check your work.");
      setResult(data.validation);
      setAttempts((n) => n + 1);
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
        <TopBar title="Practice" />
        <div className="px-5">
          <Card>
            <p className="text-sm leading-relaxed text-navy-900">{error}</p>
            <Button onClick={load} className="mt-4 w-full">
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
            <Link href="/gaps">
              <Button variant="outline" className="mt-2 w-full">
                Back to my gaps
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  if (result?.isCorrect) {
    return (
      <div className="pb-8">
        <TopBar title="Gap Repaired" back={false} />
        <div className="flex flex-col items-center px-5 pt-6">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-brand shadow-floating animate-pop-in">
            <CheckCircle2 className="h-11 w-11 text-white" />
          </span>
          <h2 className="mt-6 text-center font-display text-xl font-bold text-navy-900">
            Every step checked out.
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">{result.feedback}</p>

          <Card className="mt-6 w-full bg-lavender-50 shadow-none">
            <p className="text-xs font-semibold text-lavender-600">One more thing</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-900">
              Getting this right could still be pattern-matching. Next we&apos;ll give you the same idea in a shape
              you haven&apos;t seen — that&apos;s what proves you understood it.
            </p>
          </Card>

          <Button className="mt-6 w-full" onClick={() => router.push(`/gaps/${params.id}/transfer`)}>
            Next: Transfer <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <TopBar title="Practice to Repair" />
      <div className="px-5">
        <p className="text-center text-[13px] text-ink-soft">
          One problem built for {conceptName ? conceptName.toLowerCase() : "this gap"}.
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
            {attempts >= 2 && (
              <p className="mt-2 text-[11px] text-ink-soft">
                Stuck? Re-read the concept card — the rule you need is the one you missed the first time.
              </p>
            )}
          </div>
        )}

        <WorkInput
          className="mt-4"
          label="Your working"
          value={steps}
          onChange={setSteps}
          errorLine={result?.firstErrorLine}
          placeholder={"Write one step per line, e.g.\n2x = 8\nx = 4"}
        />

        <p className="mt-2 px-1 text-[11px] text-ink-faint">
          We check every line against the one above it — not just your final answer.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button onClick={checkWork} loading={checking} className="mt-4 w-full">
          Check My Work
        </Button>

        {attempts >= 1 && (
          <Button variant="ghost" onClick={load} className="mt-2 w-full">
            <RotateCcw className="h-4 w-4" /> Give me a different problem
          </Button>
        )}
      </div>
    </div>
  );
}
