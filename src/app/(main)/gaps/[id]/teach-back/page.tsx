"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, GraduationCap } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkInput } from "@/components/ui/WorkInput";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SourceBadge } from "@/components/ui/SourceBadge";

type Criterion = { criterion: string; met: boolean; note: string };
type Evaluation = {
  rubricScore: number;
  criteriaMet: Criterion[];
  feedback: string;
  source: "gemini" | "deterministic";
};

export default function TeachBackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [question, setQuestion] = useState<string | null>(null);
  const [conceptName, setConceptName] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The question has to be about the student's own gap. A generic prompt would
  // let them recite something they never actually got wrong.
  useEffect(() => {
    fetch(`/api/gaps/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.gap) return;
        setConceptName(d.gap.concept?.name ?? null);
        setQuestion(d.gap.teachBackQuestion ?? null);
      })
      .catch(() => {})
      .finally(() => setLoadingPrompt(false));
  }, [params.id]);

  async function submit() {
    if (explanation.trim().split(/\s+/).filter(Boolean).length < 4) {
      setError("Say a bit more — a sentence or two in your own words.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gaps/${params.id}/teach-back`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentExplanation: explanation, inputMode: "text" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't evaluate your explanation.");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't evaluate your explanation.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const strong = result.rubricScore >= 75;
    return (
      <div className="pb-8">
        <TopBar title="Teach It Back" back={false} />
        <div className="flex flex-col items-center px-5 pt-4">
          <ProgressRing value={result.rubricScore} size={128} />
          <div className="mt-2 flex items-center gap-2">
            <p className="text-xs font-semibold text-ink-soft">Explanation score</p>
            <SourceBadge source={result.source} />
          </div>

          <p className="mt-4 text-center text-sm leading-relaxed text-navy-900">{result.feedback}</p>

          <Card className="mt-5 w-full p-0">
            {result.criteriaMet.map((c, i) => (
              <div
                key={c.criterion}
                className={`flex items-start gap-2.5 px-4 py-3 ${i > 0 ? "border-t border-navy-50" : ""}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    c.met ? "bg-success" : "bg-navy-50"
                  }`}
                >
                  {c.met ? <Check className="h-3 w-3 text-white" /> : <X className="h-3 w-3 text-ink-faint" />}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm ${c.met ? "text-navy-900" : "text-ink-soft"}`}>{c.criterion}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{c.note}</p>
                </div>
              </div>
            ))}
          </Card>

          {!strong && (
            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              Try explaining it again
            </Button>
          )}

          <Button className="mt-2 w-full" onClick={() => router.push("/roadmap")}>
            See what&apos;s next
          </Button>
          <Link href="/gaps" className="mt-2 w-full">
            <Button variant="ghost" className="w-full">
              Back to my gaps
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <TopBar title="Teach It Back" />
      <div className="px-5">
        <p className="text-center text-[13px] leading-relaxed text-ink-soft">
          Explaining it in your own words is the last check — you can&apos;t fake your way through it.
        </p>

        <Card className="mt-4 bg-lavender-50 shadow-none">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
            <GraduationCap className="h-4 w-4 text-lavender-600" />
          </span>
          <p className="mt-2.5 text-sm font-semibold leading-relaxed text-navy-900">
            {loadingPrompt
              ? "Loading your question…"
              : (question ??
                `In your own words, why does ${conceptName ? conceptName.toLowerCase() : "this rule"} work the way it does?`)}
          </p>
        </Card>

        <WorkInput
          className="mt-4"
          label="Your explanation"
          value={explanation}
          onChange={setExplanation}
          voice
          rows={7}
          placeholder="Speak or type your explanation…"
        />

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button onClick={submit} loading={loading} className="mt-4 w-full">
          Submit explanation
        </Button>
      </div>
    </div>
  );
}
