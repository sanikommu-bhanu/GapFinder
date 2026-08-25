"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { StepCard } from "@/components/ui/StepCard";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { cn } from "@/lib/cn";
import { CheckCircle2, XCircle, Database, Clock } from "lucide-react";

interface CallLog {
  id: string;
  stage: string;
  model: string;
  succeeded: boolean;
  cached: boolean;
  latencyMs: number | null;
  errorText: string | null;
  retrievedChunks: { id: string; title: string }[];
  createdAt: string;
}

interface Detail {
  analysis: {
    id: string;
    subject: string;
    status: string;
    confidence: string | null;
    isDemo: boolean;
    createdAt: string;
    completedAt: string | null;
    uploadedWork: { imageUrl: string; sourceType: string; rawText: string | null } | null;
  };
  extractedSteps: { id: string; order: number; rawLine: string; interpreted: string; confidence: string; needsConfirm: boolean }[];
  reasoningSteps: { id: string; order: number; statement: string; expression: string; isValid: boolean; isFirstGap: boolean; verificationNote: string | null }[];
  gaps: {
    id: string;
    classification: string;
    surfaceError: string;
    underlyingGap: string;
    evidence: unknown;
    confidence: string;
    explanation: { whyThisIsAGap: string; whatChangedBetweenSteps: string; correctReasoning: string[]; groundedInChunkIds: string[] } | null;
    status: string;
    concept: { name: string; slug: string };
  }[];
  callLogs: CallLog[];
  practiceAttempts: { id: string; isCorrect: boolean; verifiedBy: string; feedback: string | null; createdAt: string }[];
  transferAttempts: { id: string; isCorrect: boolean; verifiedBy: string; feedback: string | null; createdAt: string }[];
  teachBackAttempts: { id: string; rubricScore: number; createdAt: string }[];
}

export default function ObservabilityDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dev/observability/${params.id}`)
      .then((r) => r.json())
      .then((d) => setData(d.analysis ? d : null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-ink-soft">Loading trace…</div>;
  if (!data) return <div className="flex h-64 items-center justify-center text-sm text-ink-soft">Not found.</div>;

  const errorLogs = data.callLogs.filter((l) => !l.succeeded);

  return (
    <div className="pb-10">
      <TopBar title="Analysis Trace" subtitle={data.analysis.subject} />
      <div className="flex flex-col gap-4 px-5">
        {/* Overview */}
        <Section title="1. Input">
          <Card>
            <p className="text-xs text-ink-soft">Source</p>
            <p className="text-sm text-navy-900">{data.analysis.uploadedWork?.sourceType ?? "unknown"}</p>
            {data.analysis.uploadedWork?.rawText && (
              <p className="mt-2 text-sm text-ink-soft">{data.analysis.uploadedWork.rawText}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {data.analysis.confidence && (
                <ConfidenceBadge level={data.analysis.confidence as "high" | "medium" | "low"} />
              )}
              <span className="text-xs font-semibold capitalize text-ink-soft">
                status: {data.analysis.status.replace(/_/g, " ")}
              </span>
            </div>
          </Card>
        </Section>

        {/* Extracted steps */}
        {data.extractedSteps.length > 0 && (
          <Section title="2. Extracted Steps (raw → interpreted)">
            <div className="flex flex-col gap-2">
              {data.extractedSteps.map((s) => (
                <Card key={s.id} className="p-3">
                  <p className="text-xs text-ink-faint">Step {s.order} · raw: “{s.rawLine}”</p>
                  <p className="font-display text-sm text-navy-900">{s.interpreted}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <ConfidenceBadge level={s.confidence as "high" | "medium" | "low"} />
                    {s.needsConfirm && <span className="text-xs font-semibold text-warning">needed confirmation</span>}
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* Reasoning + divergence */}
        {data.reasoningSteps.length > 0 && (
          <Section title="3. Reconstructed Reasoning → First Divergence">
            <div className="flex flex-col gap-2">
              {data.reasoningSteps.map((s) => (
                <StepCard
                  key={s.id}
                  title={`Step ${s.order}: ${s.statement}`}
                  expression={s.expression}
                  status={s.isFirstGap ? "error" : s.isValid ? "valid" : "warning"}
                  highlighted={s.isFirstGap}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Gaps + RAG + explanation */}
        {data.gaps.map((g) => (
          <Section key={g.id} title="4. Gap Diagnosis + Retrieved Knowledge">
            <Card className="border border-danger-50 bg-danger-50">
              <p className="text-xs font-semibold text-danger">{g.classification}</p>
              <p className="mt-1 text-sm text-navy-900">Surface: {g.surfaceError}</p>
              <p className="mt-1 text-sm text-navy-900">Underlying: {g.underlyingGap}</p>
              <p className="mt-1 text-xs text-ink-soft">Concept: {g.concept.name} ({g.concept.slug})</p>
              <ConfidenceBadge level={g.confidence as "high" | "medium" | "low"} className="mt-2" />
            </Card>
            {g.explanation && (
              <Card className="mt-2">
                <p className="text-xs font-semibold text-ink-soft">Generated intervention</p>
                <p className="mt-1 text-sm text-navy-900">{g.explanation.whyThisIsAGap}</p>
                <p className="mt-1 text-sm text-ink-soft">{g.explanation.whatChangedBetweenSteps}</p>
                {g.explanation.groundedInChunkIds.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-lavender-600">
                    <Database className="h-3 w-3" />
                    grounded in {g.explanation.groundedInChunkIds.length} chunk(s)
                  </div>
                )}
              </Card>
            )}
          </Section>
        ))}

        {/* Practice / transfer / teach-back results */}
        {(data.practiceAttempts.length > 0 || data.transferAttempts.length > 0 || data.teachBackAttempts.length > 0) && (
          <Section title="5. Practice / Transfer / Teach-Back Results">
            <div className="flex flex-col gap-2">
              {data.practiceAttempts.map((a) => (
                <ResultRow key={a.id} label="Practice" isCorrect={a.isCorrect} note={`verified: ${a.verifiedBy}`} />
              ))}
              {data.transferAttempts.map((a) => (
                <ResultRow key={a.id} label="Transfer" isCorrect={a.isCorrect} note={`verified: ${a.verifiedBy}`} />
              ))}
              {data.teachBackAttempts.map((a) => (
                <ResultRow key={a.id} label="Teach-back" isCorrect={a.rubricScore >= 70} note={`rubric: ${a.rubricScore}/100`} />
              ))}
            </div>
          </Section>
        )}

        {/* Raw call log / latency / errors */}
        <Section title={`6. AI Call Log (${data.callLogs.length} calls${errorLogs.length ? `, ${errorLogs.length} failed` : ""})`}>
          <div className="flex flex-col gap-2">
            {data.callLogs.map((l) => (
              <Card key={l.id} className={cn("p-3", !l.succeeded && "border border-danger-50 bg-danger-50")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy-900">{l.stage}</p>
                  {l.succeeded ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-danger" />
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <span>{l.model}</span>
                  {l.cached && <span className="rounded-pill bg-navy-50 px-2 py-0.5 font-semibold">cached</span>}
                  {l.latencyMs !== null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {l.latencyMs}ms
                    </span>
                  )}
                </div>
                {l.retrievedChunks.length > 0 && (
                  <p className="mt-1 text-xs text-lavender-600">
                    retrieved: {l.retrievedChunks.map((c) => c.title).join(", ")}
                  </p>
                )}
                {l.errorText && <p className="mt-1 text-xs text-danger">{l.errorText}</p>}
              </Card>
            ))}
            {data.callLogs.length === 0 && (
              <p className="text-xs text-ink-soft">
                No AI calls logged for this analysis yet — either it predates this observability instrumentation,
                or it ran fully from cache/demo data before latency tracking was added.
              </p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      {children}
    </div>
  );
}

function ResultRow({ label, isCorrect, note }: { label: string; isCorrect: boolean; note: string }) {
  return (
    <Card className="flex flex-row items-center justify-between p-3">
      <div>
        <p className="text-sm font-semibold text-navy-900">{label}</p>
        <p className="text-xs text-ink-soft">{note}</p>
      </div>
      {isCorrect ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
    </Card>
  );
}
