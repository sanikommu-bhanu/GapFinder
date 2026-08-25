"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GraduationCap, ArrowRight, Check, AlertTriangle, HelpCircle, Clock } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkInput } from "@/components/ui/WorkInput";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { cn } from "@/lib/cn";

type Question = {
  id: string;
  order: number;
  prompt: string;
  conceptName: string;
  /** "choice" questions are answered by picking an option, not by working. */
  kind?: "working" | "choice";
  options?: string[];
};
type ConceptUnderTest = { name: string; reason: string };
type Result = {
  conceptId: string;
  conceptName: string;
  verdict: "mastered" | "needs_reinforcement" | "uncertain";
  answered: number;
  correct: number;
  recurringCodes: string[];
  because: string;
};

const VERDICT = {
  mastered: { label: "Mastered", icon: Check, tone: "text-success", bg: "bg-success-50", badge: "bg-success" },
  needs_reinforcement: {
    label: "Needs reinforcement",
    icon: AlertTriangle,
    tone: "text-warning",
    bg: "bg-warning-50",
    badge: "bg-warning",
  },
  uncertain: {
    label: "Uncertain",
    icon: HelpCircle,
    tone: "text-ink-soft",
    bg: "bg-surface-muted",
    badge: "bg-ink-faint",
  },
} as const;

/**
 * Exam Mode — the same concepts, without the scaffolding.
 *
 * Two things are deliberately absent. There are no hints, and there is no
 * feedback between questions: seeing "correct" after question one changes how
 * question two is approached, which is exactly the help this mode exists to
 * remove.
 *
 * Results arrive only at the end, per concept, and mastery is never claimed
 * from a single question.
 */
function ExamView() {
  const searchParams = useSearchParams();
  // Set when the exam was launched from an explanation, to check that one
  // concept rather than everything the student has repaired.
  const conceptSlug = searchParams.get("concept");

  const [phase, setPhase] = useState<"intro" | "sitting" | "results">("intro");
  const [examId, setExamId] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ConceptUnderTest[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const questionStarted = useRef<number>(Date.now());

  useEffect(() => {
    if (phase !== "sitting") return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", ...(conceptSlug ? { conceptSlug } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Couldn't start the exam.");
      setExamId(d.examId);
      setConcepts(d.conceptsUnderTest ?? []);
      setQuestions(d.questions ?? []);
      setIndex(0);
      setElapsed(0);
      questionStarted.current = Date.now();
      setPhase("sitting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the exam.");
    } finally {
      setLoading(false);
    }
  }, [conceptSlug]);

  async function submit() {
    const question = questions[index];
    if (!question || !examId || !answer.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          examId,
          questionId: question.id,
          studentAnswer: answer.trim(),
          timeSpentSeconds: Math.round((Date.now() - questionStarted.current) / 1000),
        }),
      });

      setAnswer("");
      questionStarted.current = Date.now();

      if (index + 1 < questions.length) {
        setIndex((n) => n + 1);
      } else {
        const res = await fetch("/api/exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "finish", examId }),
        });
        const d = await res.json().catch(() => ({}));
        setResults(d.results ?? []);
        setScore(d.score ?? 0);
        setPhase("results");
      }
    } catch {
      setError("Couldn't record that answer. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const isConceptCheck = Boolean(conceptSlug);

  if (phase === "intro") {
    return (
      <div className="pb-8">
        <TopBar title={isConceptCheck ? "Concept Check" : "Exam Mode"} />
        <div className="px-5">
          <div className="flex flex-col items-center pt-2 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-900">
              <GraduationCap className="h-7 w-7 text-on-strong" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-navy-900">No hints. No feedback.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {isConceptCheck
                ? "You just had this explained. Following an explanation feels like understanding it, and the two come apart often enough that it's worth checking — so here are the wrong answers students actually give."
                : "You've repaired these in practice, where help was available. This checks whether the repair holds without it — which is the only way to know it was learning rather than following along."}
            </p>
          </div>

          {error && (
            <Card className="mt-5 bg-surface-muted shadow-none">
              <p className="text-sm leading-relaxed text-navy-900">{error}</p>
              <Link href="/gaps">
                <Button variant="outline" className="mt-3 w-full">
                  Go to my gaps
                </Button>
              </Link>
            </Card>
          )}

          <Card className="mt-5 bg-surface-muted shadow-none">
            <p className="text-xs font-semibold text-ink-soft">How it&apos;s judged</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {(isConceptCheck
                ? [
                    "Every wrong option is a real, documented misconception",
                    "One right answer is never enough to claim mastery",
                    "Choosing a wrong option records which rule you were applying",
                  ]
                : [
                    "Every line is checked, not just your final answer",
                    "One right answer is never enough to claim mastery",
                    "An old misconception coming back counts against it, whatever the score",
                  ]
              ).map((line) => (
                <li key={line} className="flex items-start gap-2 text-[12px] leading-relaxed text-navy-900">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                  {line}
                </li>
              ))}
            </ul>
          </Card>

          <Button onClick={start} loading={loading} className="mt-5 w-full">
            {isConceptCheck ? "Start the check" : "Start the exam"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "sitting") {
    const question = questions[index];
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");

    return (
      <div className="pb-8">
        <TopBar title={isConceptCheck ? "Concept Check" : "Exam"} back={false} />
        <div className="px-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Question {index + 1} of {questions.length}
            </p>
            <p className="flex items-center gap-1 text-[11px] tabular-nums text-ink-faint">
              <Clock className="h-3 w-3" />
              {minutes}:{seconds}
            </p>
          </div>

          <div className="mt-2 flex gap-1">
            {questions.map((q, i) => (
              <span
                key={q.id}
                className={cn(
                  "h-1.5 flex-1 rounded-pill",
                  i < index ? "bg-success" : i === index ? "bg-navy-900" : "bg-navy-50"
                )}
              />
            ))}
          </div>

          {question && (
            <Card className="mt-4">
              <p className="text-xs font-semibold text-ink-soft">{question.conceptName}</p>
              <p className="mt-1.5 font-display text-2xl font-bold text-navy-900">{question.prompt}</p>
            </Card>
          )}

          <WorkInput
            className="mt-4"
            label="Your working"
            value={answer}
            onChange={setAnswer}
            rows={6}
            placeholder={"Show every step.\nOne line each."}
          />

          <p className="mt-2 px-1 text-[11px] text-ink-faint">
            You won&apos;t see whether this was right until the end.
          </p>

          {error && (
            <p role="alert" className="mt-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <Button onClick={submit} loading={loading} disabled={!answer.trim()} className="mt-4 w-full">
            {index + 1 < questions.length ? "Next question" : "Finish exam"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <TopBar title={isConceptCheck ? "Check Results" : "Exam Results"} back={false} />
      <div className="flex flex-col items-center px-5">
        <ProgressRing value={score} size={124} />
        <p className="mt-2 text-xs font-semibold text-ink-soft">Right, with sound reasoning</p>

        <div className="mt-5 flex w-full flex-col gap-2.5">
          {results.map((r) => {
            const meta = VERDICT[r.verdict];
            return (
              <Card key={r.conceptId} className={cn("shadow-none", meta.bg)}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-navy-900">{r.conceptName}</p>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white",
                      meta.badge
                    )}
                  >
                    <meta.icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-navy-900">{r.because}</p>
                <p className="mt-1.5 text-[10px] text-ink-faint">
                  {r.correct} of {r.answered} correct
                </p>
              </Card>
            );
          })}
        </div>

        <Card className="mt-4 w-full bg-surface-muted shadow-none">
          <p className="text-[11px] leading-relaxed text-ink-soft">
            These verdicts are recorded against your learning history, so a concept marked
            &ldquo;needs reinforcement&rdquo; comes back in your gaps rather than being forgotten.
          </p>
        </Card>

        <Link href="/gaps" className="mt-5 w-full">
          <Button className="w-full">See my gaps</Button>
        </Link>
        <Link href={isConceptCheck ? "/learn" : "/home"} className="mt-2 w-full">
          <Button variant="ghost" className="w-full">
            {isConceptCheck ? "Learn another concept" : "Back to home"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense
      fallback={<div className="flex h-64 items-center justify-center text-sm text-ink-soft">Loading…</div>}
    >
      <ExamView />
    </Suspense>
  );
}
