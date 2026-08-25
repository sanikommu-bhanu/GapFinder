"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, ArrowRight, Lightbulb, PartyPopper } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkInput } from "@/components/ui/WorkInput";
import { cn } from "@/lib/cn";

type PlanStep = { order: number; instruction: string; reason: string; kind: string };

/**
 * Solve With Me — for a question the student hasn't started.
 *
 * The rule this screen exists to enforce: GapFinder tells them what move comes
 * next and why, and they write the line. It never writes it for them. A student
 * handed a finished solution has watched someone else think.
 *
 * Their attempt is checked by the same verifier that grades practice, so a
 * different-but-valid route is accepted rather than marked wrong for not
 * matching the predicted line.
 */
function SolveView() {
  const router = useRouter();
  const params = useSearchParams();

  const [problem, setProblem] = useState(params.get("q") ?? "");
  const [started, setStarted] = useState(false);
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [unsolvable, setUnsolvable] = useState<string | null>(null);

  const [stepIndex, setStepIndex] = useState(1);
  const [lines, setLines] = useState<string[]>([]);
  const [attempt, setAttempt] = useState("");
  const [feedback, setFeedback] = useState<{ accepted: boolean; note: string } | null>(null);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const start = useCallback(async () => {
    if (!problem.trim()) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plan", problem: problem.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't read that problem.");

      if (!d.solvable) {
        setUnsolvable(d.reason ?? "We can't work this one step by step yet.");
        setStarted(true);
        return;
      }
      setSteps(d.steps ?? []);
      setLines([problem.trim()]);
      setStepIndex(1);
      setUnsolvable(null);
      setStarted(true);
    } catch (err) {
      setUnsolvable(err instanceof Error ? err.message : "Couldn't read that problem.");
      setStarted(true);
    } finally {
      setLoading(false);
    }
  }, [problem]);

  // Deep-linked from the analyser when it detects a question with no working.
  useEffect(() => {
    if (params.get("q") && !started) void start();
    // Only on mount — restarting on every keystroke would be maddening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAttempt() {
    if (!attempt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check",
          problem,
          previousLine: lines[lines.length - 1] ?? problem,
          attempt: attempt.trim(),
          stepIndex,
        }),
      });
      const d = await res.json().catch(() => ({}));
      setFeedback({ accepted: Boolean(d.accepted), note: d.note ?? "" });

      if (d.accepted) {
        setLines((prev) => [...prev, attempt.trim()]);
        setAttempt("");
        if (d.finished) setFinalAnswer(d.finalAnswer ?? attempt.trim());
        else setStepIndex((n) => n + 1);
      }
    } catch {
      setFeedback({ accepted: false, note: "Couldn't check that just now. Try again." });
    } finally {
      setLoading(false);
    }
  }

  if (!started) {
    return (
      <div className="pb-8">
        <TopBar title="Solve With Me" />
        <div className="px-5">
          <p className="text-center text-[13px] leading-relaxed text-ink-soft">
            Stuck on a question? Type it in and we&apos;ll work through it together — one step at a time, with you
            writing each line.
          </p>

          <WorkInput
            className="mt-5"
            label="The question"
            value={problem}
            onChange={setProblem}
            rows={3}
            placeholder={"2x + 7 = 15"}
          />

          <Button onClick={start} loading={loading} disabled={!problem.trim()} className="mt-4 w-full">
            Start solving <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-surface-muted p-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-peach-500" />
            <p className="text-xs leading-relaxed text-ink-soft">
              We won&apos;t write the answer for you. You&apos;ll get the next move and the reason behind it — then
              you write the line, and we check it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (unsolvable) {
    return (
      <div className="pb-8">
        <TopBar title="Solve With Me" onBack={() => setStarted(false)} />
        <div className="px-5">
          <Card>
            <p className="text-sm leading-relaxed text-navy-900">{unsolvable}</p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => setStarted(false)}>
              Try a different question
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (finalAnswer) {
    return (
      <div className="pb-8">
        <TopBar title="Solved" back={false} />
        <div className="flex flex-col items-center px-5 pt-6">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-brand shadow-floating animate-pop-in">
            <PartyPopper className="h-9 w-9 text-white" />
          </span>
          <h2 className="mt-5 text-center font-display text-xl font-bold text-navy-900">You solved it.</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">
            Every line was yours. We only said which move came next.
          </p>

          <Card className="mt-6 w-full">
            <p className="text-xs font-semibold text-ink-soft">Your working</p>
            <ol className="mt-2 flex flex-col gap-1.5">
              {lines.map((line, i) => (
                <li key={i} className="font-display text-base text-navy-900">
                  {line}
                </li>
              ))}
            </ol>
          </Card>

          <Button className="mt-6 w-full" onClick={() => router.push("/scan")}>
            Analyze some of my own work
          </Button>
          <Link href="/home" className="mt-2 w-full">
            <Button variant="ghost" className="w-full">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const current = steps[stepIndex - 1];

  return (
    <div className="pb-8">
      <TopBar title="Solve With Me" onBack={() => setStarted(false)} />
      <div className="px-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Step {stepIndex} of {steps.length}
          </p>
          <div className="flex gap-1">
            {steps.map((s) => (
              <span
                key={s.order}
                className={cn(
                  "h-1.5 w-4 rounded-pill",
                  s.order < stepIndex ? "bg-success" : s.order === stepIndex ? "bg-navy-900" : "bg-navy-50"
                )}
              />
            ))}
          </div>
        </div>

        <Card className="mt-3">
          <p className="text-xs font-semibold text-ink-soft">Your working so far</p>
          <ol className="mt-2 flex flex-col gap-1">
            {lines.map((line, i) => (
              <li key={i} className="flex items-center gap-2">
                {i > 0 && <Check className="h-3 w-3 shrink-0 text-success" />}
                <span className={cn("font-display text-base", i === 0 ? "text-ink-soft" : "text-navy-900")}>
                  {line}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        {current && (
          <Card className="mt-3 bg-lavender-50 shadow-none">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-lavender-600">Next move</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-navy-900">{current.instruction}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-navy-900/75">{current.reason}</p>
          </Card>
        )}

        {feedback && !feedback.accepted && (
          <div className="mt-3 rounded-2xl bg-danger-50 p-3.5">
            <p className="text-sm leading-relaxed text-navy-900">{feedback.note}</p>
          </div>
        )}
        {feedback?.accepted && (
          <div className="mt-3 rounded-2xl bg-success-50 p-3.5">
            <p className="text-sm leading-relaxed text-navy-900">{feedback.note}</p>
          </div>
        )}

        <WorkInput
          className="mt-3"
          label="Your next line"
          value={attempt}
          onChange={setAttempt}
          rows={2}
          placeholder="Write it yourself…"
        />

        <Button onClick={submitAttempt} loading={loading} disabled={!attempt.trim()} className="mt-3 w-full">
          Check this line
        </Button>
      </div>
    </div>
  );
}

export default function SolvePage() {
  return (
    <Suspense
      fallback={<div className="flex h-64 items-center justify-center text-sm text-ink-soft">Loading…</div>}
    >
      <SolveView />
    </Suspense>
  );
}
