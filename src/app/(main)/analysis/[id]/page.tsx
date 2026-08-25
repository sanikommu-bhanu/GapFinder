"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight, ListChecks } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { StepCard, type StepVerdict } from "@/components/ui/StepCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { GroundedNote } from "@/components/ui/GroundedNote";
import { FirstGapReveal } from "@/components/analysis/FirstGapReveal";
import { CorrectedSolution } from "@/components/analysis/CorrectedSolution";
import { SocraticPrompt } from "@/components/analysis/SocraticPrompt";
import { MisconceptionCard } from "@/components/analysis/MisconceptionCard";
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
  verdict: StepVerdict;
};

type Explanation = {
  whyThisIsAGap: string;
  whatChangedBetweenSteps: string;
  correctReasoning: string[];
  groundedInChunkIds: string[];
};

type Misconception = {
  code: string;
  basis: "proved" | "matched";
  evidence: string;
  name: string;
  studentRule: string;
  whyItFails: string;
  socraticPrompt: string;
};

type Gap = {
  id: string;
  classification: string;
  surfaceError: string;
  underlyingGap: string;
  confidence: "high" | "medium" | "low";
  explanation: Explanation | null;
  evidence: { stepOrder: number; note: string }[];
  misconception: Misconception | null;
  concept: { id: string; name: string; slug: string };
};

const VIEWS = ["replay", "first-gap", "audit", "socratic", "explanation", "concept"] as const;
type View = (typeof VIEWS)[number];

export default function AnalysisDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const setActiveGap = useAppStore((s) => s.setActiveGap);

  const [view, setView] = useState<View>("replay");
  const [steps, setSteps] = useState<ReasoningStep[]>([]);
  const [correctedSolution, setCorrectedSolution] = useState<string[]>([]);
  const [gap, setGap] = useState<Gap | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("complete");
  const [statusReason, setStatusReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Steps are revealed one at a time so the divergence lands, not scrolls past. */
  const [revealed, setRevealed] = useState(0);

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
        setStatusReason(d.analysis.statusReason ?? null);
        setSteps(d.analysis.reasoningSteps ?? []);
        setCorrectedSolution(d.analysis.correctedSolution ?? []);
        setGap(d.analysis.gaps?.[0] ?? null);
        setImageUrl(d.analysis.uploadedWork?.imageUrl || null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  // Reveal cadence: quick enough not to waste a judge's time, slow enough that
  // the eye follows the chain down to the step that breaks.
  useEffect(() => {
    if (loading || view !== "replay" || steps.length === 0) return;
    if (revealed >= steps.length) return;
    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setRevealed(steps.length);
      return;
    }
    const timer = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 120 : 330);
    return () => clearTimeout(timer);
  }, [loading, view, steps.length, revealed]);

  const firstGapStep = useMemo(() => steps.find((s) => s.isFirstGap), [steps]);
  const previousStep = useMemo(() => {
    const i = steps.findIndex((s) => s.isFirstGap);
    return i > 0 ? steps[i - 1] : undefined;
  }, [steps]);

  const downstream = steps.filter((s) => s.verdict === "downstream_consequence").length;
  const independent = steps.filter((s) => s.verdict === "independent_error").length;
  const allRevealed = revealed >= steps.length;

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <div className="mx-auto h-6 w-40 animate-pulse rounded-pill bg-navy-50" />
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pb-8">
        <TopBar title="Analysis" />
        <div className="px-5">
          <Card>
            <p className="text-sm text-navy-900">{error}</p>
            <Link href="/history">
              <Button variant="outline" className="mt-4 w-full">
                Back to history
              </Button>
            </Link>
          </Card>
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
              {statusReason ?? "This analysis didn't finish. Your work is still saved in history."}
            </p>
            <Link href="/scan">
              <Button className="mt-4 w-full">Try again</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  // No divergence is a real, meaningful result — say so plainly rather than
  // inventing something to correct.
  if (!firstGapStep) {
    return (
      <div className="pb-8">
        <TopBar title="No gaps found" />
        <div className="flex flex-col items-center px-5 pt-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-success-50 animate-pop-in">
            <CheckCircle2 className="h-9 w-9 text-success" />
          </span>
          <h2 className="mt-5 text-center font-display text-xl font-bold text-navy-900">Every step checked out.</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">
            We verified each transition algebraically. None of them changed the solution set — your reasoning holds.
          </p>

          {/* If part of the work was unreadable, say so rather than letting the
              headline imply we checked everything. */}
          {statusReason && (
            <p className="mt-3 rounded-2xl bg-warning-50 px-4 py-3 text-center text-xs leading-relaxed text-navy-900">
              {statusReason}
            </p>
          )}

          <div className="mt-6 flex w-full flex-col gap-2.5">
            {steps.map((s) => (
              <StepCard key={s.id} title={`Step ${s.order}`} expression={s.expression} verdict={s.verdict} />
            ))}
          </div>

          <Link href="/scan" className="mt-5 w-full">
            <Button className="w-full">Analyze another problem</Button>
          </Link>
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
            <p className="text-center text-[13px] leading-relaxed text-ink-soft">
              We rebuilt your reasoning and checked every line against the one before it.
            </p>

            <div className="mt-4 flex flex-col gap-2.5">
              {steps.map((s, i) => (
                <div
                  key={s.id}
                  className={
                    i < revealed
                      ? "animate-fade-up"
                      : "pointer-events-none h-0 overflow-hidden opacity-0"
                  }
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <StepCard
                    title={`Step ${s.order}`}
                    expression={s.expression}
                    statement={s.statement}
                    verdict={s.verdict}
                    highlighted={s.isFirstGap && allRevealed}
                    dimmed={allRevealed && !s.isFirstGap && s.verdict !== "independent_error"}
                  />
                </div>
              ))}
            </div>

            {allRevealed && (
              <div className="animate-fade-up">
                <Card className="mt-4 bg-surface-muted shadow-none">
                  <p className="text-xs leading-relaxed text-ink-soft">
                    <span className="font-semibold text-navy-900">One mistake, not {1 + downstream}.</span>{" "}
                    {downstream > 0
                      ? `Step ${firstGapStep.order} is where the reasoning changed. The ${downstream} step${downstream === 1 ? "" : "s"} after it ${downstream === 1 ? "was" : "were"} worked correctly — from a line that was already wrong.`
                      : `Step ${firstGapStep.order} is where the reasoning changed.`}
                    {independent > 0 &&
                      ` We also found ${independent} separate mistake${independent === 1 ? "" : "s"} further down.`}
                  </p>
                </Card>

                <Button className="mt-4 w-full" onClick={() => setView("first-gap")}>
                  Show me where it broke <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {view === "first-gap" && (
        <FirstGapReveal
          step={firstGapStep}
          previousExpression={previousStep?.expression ?? null}
          conceptName={gap?.concept.name ?? null}
          confidence={gap?.confidence ?? null}
          imageUrl={imageUrl}
          downstreamCount={downstream}
          onBack={() => setView("replay")}
          onContinue={() => setView("audit")}
        />
      )}

      {view === "audit" && (
        <>
          <TopBar title="Complete Audit" onBack={() => setView("first-gap")} />
          <div className="px-5">
            <p className="text-center text-[13px] leading-relaxed text-ink-soft">
              Every line judged, and the path it should have taken.
            </p>

            <div className="mt-4 flex flex-col gap-2.5">
              {steps.map((s) => (
                <StepCard
                  key={s.id}
                  title={`Step ${s.order}`}
                  expression={s.expression}
                  statement={s.verificationNote ?? undefined}
                  verdict={s.verdict}
                  highlighted={s.isFirstGap}
                />
              ))}
            </div>

            <CorrectedSolution
              lines={correctedSolution}
              className="mt-5"
              divergenceExpression={firstGapStep.expression}
            />

            <Button
              className="mt-5 w-full"
              onClick={() => setView(gap?.misconception ? "socratic" : "explanation")}
              disabled={!gap}
            >
              Why did this happen? <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {view === "socratic" && gap?.misconception && (
        <>
          <TopBar title="Your turn" onBack={() => setView("audit")} />
          <SocraticPrompt
            question={gap.misconception.socraticPrompt}
            hint={gap.misconception.whyItFails}
            onReveal={() => setView("explanation")}
          />
        </>
      )}

      {view === "explanation" && gap && (
        <>
          <TopBar
            title="Gap Explanation"
            onBack={() => setView(gap.misconception ? "socratic" : "audit")}
          />
          <div className="px-5">
            <Card className="border border-danger-50 bg-danger-50">
              <p className="text-xs font-semibold text-danger">Surface error</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-900">{gap.surfaceError}</p>
            </Card>

            {gap.misconception && <MisconceptionCard misconception={gap.misconception} className="mt-3" />}

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
                <p className="mt-1 text-sm leading-relaxed text-navy-900">{gap.explanation.whatChangedBetweenSteps}</p>
              </Card>
            )}

            {gap.explanation?.whyThisIsAGap && (
              <Card className="mt-3">
                <p className="text-xs font-semibold text-ink-soft">Why this is a gap, not a slip</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-900">{gap.explanation.whyThisIsAGap}</p>
              </Card>
            )}

            {gap.evidence?.length > 0 && (
              <Card className="mt-3">
                <div className="flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5 text-ink-faint" />
                  <p className="text-xs font-semibold text-ink-soft">Evidence from your work</p>
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {gap.evidence.map((e, i) => (
                    <p key={i} className="text-[11px] leading-relaxed text-ink-soft">
                      <span className="font-semibold text-navy-900">Step {e.stepOrder}:</span> {e.note}
                    </p>
                  ))}
                </div>
              </Card>
            )}

            <GroundedNote chunkIds={gap.explanation?.groundedInChunkIds ?? []} className="mt-3" />

            <Button className="mt-4 w-full" onClick={() => setView("concept")}>
              Teach me this <ArrowRight className="h-4 w-4" />
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
                originalExpression: previousStep?.expression ?? steps[0]?.expression,
                correctedExpression: firstGapStep.correctedExpression ?? undefined,
              });
              if (visual.kind === "none") {
                // No safe deterministic diagram for this shape — the written
                // explanation stands alone rather than showing an invented one.
                return (
                  <Card className="mt-4">
                    <p className="text-sm font-semibold text-navy-900">The rule behind this step</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      An equation is a balance. Whatever you do to one side you must do to the other, or the two sides
                      stop describing the same value — which is what happened at step {firstGapStep.order}.
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

            {gap.explanation?.correctReasoning?.length ? (
              <Card className="mt-3 border border-success-50">
                <p className="text-xs font-semibold text-success">Correct reasoning</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {gap.explanation.correctReasoning.map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-[10px] font-bold text-success">
                        {i + 1}
                      </span>
                      <p className="font-display text-sm leading-relaxed text-navy-900">{line}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <Button
              className="mt-5 w-full"
              onClick={() => {
                setActiveGap(gap.id);
                router.push(`/gaps/${gap.id}/practice`);
              }}
            >
              Practice to repair <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/home">
              <Button variant="ghost" className="mt-2 w-full">
                Later
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
