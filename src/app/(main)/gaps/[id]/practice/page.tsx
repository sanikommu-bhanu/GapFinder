"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Problem = { id: string; prompt: string; correctAnswer: string };

export default function PracticePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [steps, setSteps] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; feedback: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/gaps/${params.id}/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "repair" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.problem) setProblem(d.problem);
        else if (d.error) setError(d.error);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  async function checkWork() {
    if (!problem) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/practice-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gapId: params.id, problemId: problem.id, studentSteps: steps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't check your work.");
      setResult({ isCorrect: data.validation.isCorrect, feedback: data.validation.feedback });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-ink-soft">Preparing your practice problem…</div>;

  if (result?.isCorrect) {
    return (
      <div className="pb-6">
        <TopBar title="Verifying Answer" back={false} />
        <div className="flex flex-col items-center px-5 pt-8">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-brand shadow-floating">
            <CheckCircle2 className="h-12 w-12 text-white" />
          </span>
          <h2 className="mt-6 font-display text-xl font-bold text-navy-900">Great! You got it right.</h2>
          <p className="mt-1 text-sm text-ink-soft">{result.feedback}</p>
          <Button className="mt-8 w-full" onClick={() => router.push(`/gaps/${params.id}/transfer`)}>
            Next: Transfer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <TopBar title="Practice to Repair" subtitle="One problem designed for this gap." />
      <div className="px-5">
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {problem && (
          <Card>
            <p className="text-xs font-semibold text-ink-soft">Solve for x</p>
            <p className="mt-1 font-display text-xl text-navy-900">{problem.prompt}</p>
          </Card>
        )}
        {result && !result.isCorrect && (
          <div className="mt-3 rounded-2xl bg-danger-50 p-3 text-sm text-danger">{result.feedback}</div>
        )}
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder="Write your steps here…"
          className="mt-4 h-40 w-full rounded-2xl border border-navy-50 bg-surface-muted p-4 text-sm outline-none focus:border-lavender-400"
        />
        <Button className="mt-4 w-full" onClick={checkWork} loading={checking}>
          Check My Work
        </Button>
      </div>
    </div>
  );
}
