"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";

type Step = {
  id: string;
  order: number;
  rawLine: string;
  interpreted: string;
  confidence: "high" | "medium" | "low";
  needsConfirm: boolean;
};

/**
 * The honesty screen. When the vision pass isn't sure what a line says, the
 * product stops and asks rather than analysing a guess — because a first
 * divergence computed from a misread line would be confidently wrong, which is
 * the one failure mode this product cannot afford.
 */
export default function ConfirmReadingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/analyses/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load this analysis."))))
      .then((d) => {
        if (d.analysis?.status === "complete") {
          router.replace(`/analysis/${params.id}`);
          return;
        }
        setSteps(d.analysis?.extractedSteps ?? []);
        setQuestion(d.analysis?.statusReason ?? null);
        setImageUrl(d.analysis?.uploadedWork?.imageUrl ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  function edit(order: number, value: string) {
    setSteps((prev) => prev.map((s) => (s.order === order ? { ...s, interpreted: value } : s)));
  }

  async function confirm() {
    if (steps.some((s) => !s.interpreted.trim())) {
      setError("Every line needs some text. Delete a line's content only if you rewrite it.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyses/${params.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: steps.map((s) => ({ order: s.order, interpreted: s.interpreted.trim() })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't submit your corrections.");
      router.replace(`/analyzing?id=${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your corrections.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-ink-soft">Loading what we read…</div>;
  }

  return (
    <div className="pb-8">
      <TopBar title="Did we read this right?" />
      <div className="px-5">
        <div className="flex items-start gap-2 rounded-2xl bg-warning-50 p-3">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-navy-900">
            {question ??
              "Some of your handwriting was hard to read. We'd rather ask than analyze the wrong thing — fix anything we got wrong."}
          </p>
        </div>

        {imageUrl && (
          <Card className="mt-3 overflow-hidden p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Your uploaded work" className="max-h-56 w-full object-contain" />
          </Card>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {steps.map((s) => (
            <div key={s.id}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-soft">Line {s.order}</p>
                {s.confidence !== "high" && <ConfidenceBadge level={s.confidence} />}
              </div>
              <input
                value={s.interpreted}
                onChange={(e) => edit(s.order, e.target.value)}
                aria-label={`Line ${s.order}`}
                inputMode="text"
                className={`h-12 w-full rounded-2xl border bg-surface-muted px-4 font-display text-base text-navy-900 outline-none focus:border-lavender-400 ${
                  s.needsConfirm ? "border-warning" : "border-navy-50"
                }`}
              />
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button onClick={confirm} loading={submitting} className="mt-5 w-full">
          Yes, analyze this
        </Button>
      </div>
    </div>
  );
}
