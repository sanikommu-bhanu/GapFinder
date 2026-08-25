"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight, ScanLine } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { StepCard } from "@/components/ui/StepCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { GroundedNote } from "@/components/ui/GroundedNote";
import { useAppStore } from "@/store/useAppStore";
import { ConceptVisual } from "@/components/visuals/ConceptVisual";
import { selectConceptVisual } from "@/lib/ai/visuals/select-visual";

type ReasoningStep = {
  id: string;
  order: number;
  statement: string;
  expression: string;
  isValid: boolean;
  isFirstGap: boolean;
  verificationNote: string | null;
  correctedExpression: string | null;
};

type Explanation = {
  whyThisIsAGap: string;
  whatChangedBetweenSteps: string;
  correctReasoning: string[];
  groundedInChunkIds: string[];
};

type Gap = {
  id: string;
  classification: string;
  surfaceError: string;
  underlyingGap: string;
  confidence: "high" | "medium" | "low";
  explanation: Explanation | null;
  concept: { id: string; name: string; slug: string };
};

const VIEWS = ["replay", "first-gap", "explanation", "concept"] as const;
type View = (typeof VIEWS)[number];

export default function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const setActiveGap = useAppStore((s) => s.setActiveGap);
  const [view, setView] = useState<View>("replay");
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[]>([]);
  const [gap, setGap] = useState<Gap | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("complete");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/analyses/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("We couldn't load this analysis."))))
      .then((d) => {
        if (!d.analysis) throw new Error("We couldn't load this analysis.");
        if (d.analysis.status === "needs_confirmation") {
          router.replace(`/analysis/${params.id}/confirm`);
          return;
        }
        setStatus(d.analysis.status);
        setReasoningSteps(d.analysis.reasoningSteps ?? []);
        setGap(d.analysis.gaps?.[0] ?? null);
        setImageUrl(d.analysis.uploadedWork?.imageUrl ?? null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  const firstGapStep = useMemo(() => reasoningSteps.find((s) => s.isFirstGap), [reasoningSteps]);
  const previousStep = useMemo(() => {
    const i = reasoningSteps.findIndex((s) => s.isFirstGap);
    return i > 0 ? reasoningSteps[i - 1] : undefined;
  }, [reasoningSteps]);

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <div className="h-6 w-40 animate-pulse rounded-pill bg-navy-50" />
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 pt-6">
        <TopBar title="Analysis" />
        <Card>
          <p className="text-sm text-navy-900">{error}</p>
          <Link href="/history">
            <Button variant="outline" className="mt-4 w-full">
              Back to history
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // A completed analysis with no divergence is a real, meaningful result — the
  // student's reasoning held up. Saying so plainly matters more than inventing
  // something to correct.
  if (status === "complete" && !firstGapStep) {
    return (
      <div className="pb-8">
        <TopBar title="No gaps found" />
        <div className="flex flex-col items-center px-5 pt-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-success-50">
            <CheckCircle2 className="h-9 w-9 text-success" />
          </span>
          <h2 className="mt-5 text-center font-display text-xl font-bold text-navy-900">
            Every step checked out.
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">
            We verified each transition algebraically and none of them changed the solution set. Your reasoning holds.
          </p>

          <div className="mt-6 w-full flex-col gap-2.5">
            {reasoningSteps.map((s) => (
              <StepCard
                key={s.id}
                title={`Step ${s.order}`}
                expression={s.expression}
                status="valid"
                className="mb-2.5"
              />
            ))}
          </div>

          <Link href="/scan" className="mt-4 w-full">
            <Button className="w-full">Analyze another problem</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="pb-8">
        <TopBar title="Analysis stopped" />
        <div className="px-5">
          <Card>
            <p className="text-sm leading-relaxed text-navy-900">
              This analysis didn&apos;t finish. Your photo is still saved in history.
            </p>
            <Link href="/scan">
              <Button className="mt-4 w-full">Try another photo</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {view === "replay" && (
        <>
          <TopBar title="Reasoning Replay" />
          <div className="px-5">
            <p className="text-center text-[13px] text-ink-soft">
              We reconstructed your steps and checked each one against the one before it.
            </p>

            <div className="mt-4 flex flex-col gap-2.5">
              {reasoningSteps.map((s) => (
                <StepCard
                  key={s.id}
                  title={`Step ${s.order}`}
                  expression={s.expression}
                  statement={s.isFirstGap ? "First gap found" : s.isValid ? undefined : "Consequence of the gap above"}
                  status={s.isFirstGap ? "error" : s.isValid ? "valid" : "warning"}
                  highlighted={s.isFirstGap}
                />
              ))}
            </div>

            <Button className="mt-5 w-full" onClick={() => setView("first-gap")}>
              View Details
            </Button>
          </div>
        </>
      )}

      {view === "first-gap" && firstGapStep && (
        <>
          <TopBar title="First Gap Found" onBack={() => setView("replay")} />
          <div className="px-5">
            {imageUrl && (
              <Card className="overflow-hidden p-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Your work" className="max-h-40 w-full object-contain" />
              </Card>
            )}

            <Card className="mt-3 border-2 border-danger bg-white text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-danger">
                Step {firstGapStep.order} · First divergence
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-navy-900">{firstGapStep.expression}</p>
            </Card>

            {previousStep && (
              <Card className="mt-3 bg-surface-muted">
                <p className="text-xs font-semibold text-ink-soft">Everything up to here was correct</p>
                <p className="mt-1 font-display text-base text-navy-900">{previousStep.expression}</p>
              </Card>
            )}

            <Card className="mt-3 border border-danger-50 bg-danger-50">
              <p className="text-xs font-semibold text-danger">You wrote</p>
              <p className="mt-1 font-display text-lg text-navy-900">{firstGapStep.expression}</p>
            </Card>

            {firstGapStep.correctedExpression ? (
              <Card className="mt-3 border border-success-50 bg-success-50">
                <p className="text-xs font-semibold text-success">But it should be</p>
                <p className="mt-1 font-display text-lg text-navy-900">{firstGapStep.correctedExpression}</p>
              </Card>
            ) : (
              // No algebraically derived correction — say nothing rather than guess.
              <Card className="mt-3 bg-surface-muted">
                <p className="text-xs font-semibold text-ink-soft">Why this step fails</p>
                <p className="mt-1 text-sm text-navy-900">{firstGapStep.verificationNote}</p>
              </Card>
            )}

            <p className="mt-3 px-1 text-[11px] leading-relaxed text-ink-faint">
              Checked algebraically — the two equations have different solutions, so this step cannot follow from the
              one above it.
            </p>

            <Button className="mt-4 w-full" onClick={() => setView("explanation")} disabled={!gap}>
              Explain This Gap
            </Button>
          </div>
        </>
      )}

      {view === "explanation" && gap && (
        <>
          <TopBar title="Gap Explanation" onBack={() => setView("first-gap")} />
          <div className="px-5">
            <Card className="border border-danger-50 bg-danger-50">
              <p className="text-xs font-semibold text-danger">Surface error</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-900">{gap.surfaceError}</p>
            </Card>

            <Card className="mt-3 border border-lavender-200 bg-lavender-50">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-lavender-600">Underlying gap</p>
                <ConfidenceBadge level={gap.confidence} />
              </div>
              <p className="mt-1.5 text-sm font-semibold text-navy-900">{gap.concept.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-900">{gap.underlyingGap}</p>
            </Card>

            {gap.explanation?.whatChangedBetweenSteps && (
              <Card className="mt-3">
                <p className="text-xs font-semibold text-ink-soft">What changed between steps</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-900">
                  {gap.explanation.whatChangedBetweenSteps}
                </p>
              </Card>
            )}

            {gap.explanation?.whyThisIsAGap && (
              <Card className="mt-3">
                <p className="text-xs font-semibold text-ink-soft">Why this is a gap, not a slip</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-900">{gap.explanation.whyThisIsAGap}</p>
              </Card>
            )}

            {gap.explanation?.correctReasoning?.length ? (
              <Card className="mt-3 border border-success-50">
                <p className="text-xs font-semibold text-success">Correct reasoning</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {gap.explanation.correctReasoning.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-[10px] font-bold text-success">
                        {i + 1}
                      </span>
                      <p className="font-display text-sm text-navy-900">{line}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <GroundedNote chunkIds={gap.explanation?.groundedInChunkIds ?? []} className="mt-3" />

            <Button className="mt-4 w-full" onClick={() => setView("concept")}>
              Got it!
            </Button>
          </div>
        </>
      )}

      {view === "concept" && gap && (
        <>
          <TopBar title="Concept Visual" onBack={() => setView("explanation")} />
          <div className="px-5">
            <p className="text-center text-[13px] text-ink-soft">{gap.concept.name}</p>

            {(() => {
              const visual = selectConceptVisual({
                conceptSlug: gap.concept.slug,
                originalExpression: previousStep?.expression ?? reasoningSteps[0]?.expression,
                correctedExpression: firstGapStep?.correctedExpression ?? undefined,
              });
              if (visual.kind === "none") {
                // No safe deterministic diagram for this shape — the written
                // explanation stands on its own rather than showing a made-up one.
                return (
                  <Card className="mt-4">
                    <p className="text-sm font-semibold text-navy-900">The rule behind this step</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      An equation is a balance. Whatever you do to one side you must do to the other, or the two sides
                      stop describing the same value — which is exactly what happened at step {firstGapStep?.order}.
                    </p>
                  </Card>
                );
              }
              return (
                <Card className="mt-4">
                  <ConceptVisual visual={visual} />
                </Card>
              );
            })()}

            <Button
              className="mt-5 w-full"
              onClick={() => {
                setActiveGap(gap.id);
                router.push(`/gaps/${gap.id}/practice`);
              }}
            >
              Practice to Repair <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/home">
              <Button variant="ghost" className="mt-2 w-full">
                <ScanLine className="h-4 w-4" /> Later
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
