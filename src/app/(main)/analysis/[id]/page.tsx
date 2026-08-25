"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/nav/TopBar";
import { StepCard } from "@/components/ui/StepCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
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
};
type Gap = {
  id: string;
  classification: string;
  surfaceError: string;
  underlyingGap: string;
  confidence: string;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analyses/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.analysis) {
          setReasoningSteps(d.analysis.reasoningSteps ?? []);
          setGap(d.analysis.gaps?.[0] ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-soft">Loading analysis…</div>
    );
  }

  const firstGapStep = reasoningSteps.find((s) => s.isFirstGap);

  return (
    <div className="pb-6">
      {view === "replay" && (
        <>
          <TopBar title="Reasoning Replay" subtitle="We reconstructed your steps" />
          <div className="flex flex-col gap-3 px-5">
            {reasoningSteps.map((s) => (
              <StepCard
                key={s.id}
                title={`Step ${s.order}`}
                expression={s.expression}
                status={s.isFirstGap ? "error" : s.isValid ? "valid" : "warning"}
                highlighted={s.isFirstGap}
              />
            ))}
            <Button className="mt-4 w-full" onClick={() => setView("first-gap")}>
              View Details
            </Button>
          </div>
        </>
      )}

      {view === "first-gap" && firstGapStep && (
        <>
          <TopBar title="First Gap Found" subtitle={`Step ${firstGapStep.order}`} />
          <div className="px-5">
            <Card className="items-center gap-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-danger">First Divergence</p>
              <p className="mt-2 font-display text-2xl text-navy-900">{firstGapStep.expression}</p>
            </Card>
            <Card className="mt-3">
              <p className="text-xs font-semibold text-ink-soft">You wrote</p>
              <p className="mt-1 font-display text-navy-900">{firstGapStep.expression}</p>
              <p className="mt-3 text-xs font-semibold text-ink-soft">But it should be</p>
              <p className="mt-1 font-display text-success">{firstGapStep.verificationNote}</p>
            </Card>
            <Button className="mt-4 w-full" onClick={() => setView("explanation")}>
              Explain This Gap
            </Button>
          </div>
        </>
      )}

      {view === "explanation" && gap && (
        <>
          <TopBar title="Gap Explanation" />
          <div className="px-5">
            <Card className="border border-danger-50 bg-danger-50">
              <p className="text-xs font-semibold text-danger">Surface Error</p>
              <p className="mt-1 text-sm text-navy-900">{gap.surfaceError}</p>
            </Card>
            <Card className="mt-3 border border-lavender-200 bg-lavender-50">
              <p className="text-xs font-semibold text-lavender-600">Underlying Gap</p>
              <p className="mt-1 text-sm text-navy-900">{gap.underlyingGap}</p>
              <ConfidenceBadge level={(gap.confidence as any) ?? "medium"} className="mt-2" />
            </Card>
            <Button className="mt-4 w-full" onClick={() => setView("concept")}>
              Got it!
            </Button>
          </div>
        </>
      )}

      {view === "concept" && gap && (
        <>
          <TopBar title="Concept Visual" subtitle={gap.concept.name} />
          <div className="px-5">
            {(() => {
              const originalExpression = reasoningSteps[0]?.expression;
              const correctedExpression = firstGapStep?.verificationNote ?? undefined;
              const visual = selectConceptVisual({
                conceptSlug: gap.concept.slug,
                originalExpression,
                correctedExpression,
              });
              if (visual.kind === "none") {
                return (
                  <Card>
                    <p className="text-sm font-semibold text-navy-900">We must do the same operation on both sides.</p>
                    <p className="mt-2 text-sm text-ink-soft">
                      Think of the equation as a balance scale — whatever you remove from one side, remove from the
                      other, or it tips out of balance.
                    </p>
                  </Card>
                );
              }
              return (
                <Card>
                  <ConceptVisual visual={visual} />
                </Card>
              );
            })()}
            <Button
              className="mt-4 w-full"
              onClick={() => {
                setActiveGap(gap.id);
                router.push(`/gaps/${gap.id}/practice`);
              }}
            >
              Practice to Repair
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
