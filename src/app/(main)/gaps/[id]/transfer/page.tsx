"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Problem = { id: string; prompt: string; correctAnswer: string };

export default function TransferPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [steps, setSteps] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; feedback: string | null } | null>(null);
  const [masteryScore, setMasteryScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/gaps/${params.id}/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "transfer" }),
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
      const res = await fetch("/api/transfer-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gapId: params.id, problemId: problem.id, studentSteps: steps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't check your work.");
      setResult({ isCorrect: data.validation.isCorrect, feedback: data.validation.feedback });
      setMasteryScore(data.masteryScore ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-ink-soft">Preparing a transfer problem…</div>;

  if (result?.isCorrect) {
    return (
      <div className="pb-6">
        <TopBar title="Transfer Verified!" back={false} />
        <div className="flex flex-col items-center px-5 pt-8">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-brand shadow-floating">
            <Star className="h-12 w-12 text-white" />
          </span>
          <h2 className="mt-6 text-center font-display text-xl font-bold text-navy-900">
            Amazing! You applied the same concept in a new way.
          </h2>
          <Card className="mt-6 w-full text-center">
            <p className="text-xs font-semibold text-ink-soft">Inverse Operations</p>
            <p className="mt-1 text-sm font-semibold text-navy-900">Mastery Updated</p>
            <p className="mt-1 font-display text-3xl font-bold text-navy-900">{masteryScore ?? "—"}%</p>
          </Card>
          <Button className="mt-6 w-full" onClick={() => router.push(`/gaps/${params.id}/teach-back`)}>
            View My Progress
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <TopBar title="Transfer Problem" subtitle="Let's see if you can use it in a different form." />
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
          Check Answer
        </Button>
      </div>
    </div>
  );
}
