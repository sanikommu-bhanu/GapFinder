"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Send, AlertTriangle, GraduationCap, BookOpen, Mic } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { ConceptVisual } from "@/components/visuals/ConceptVisual";
import { TeachMe } from "@/components/analysis/TeachMe";
import { ResourcePanel } from "@/components/analysis/ResourcePanel";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { SUBJECTS } from "@/lib/subjects";
import type { VisualModule } from "@/lib/ai/visuals/select-visual";
import type { LessonLine } from "@/lib/teaching/build-lesson";
import { cn } from "@/lib/cn";

interface ExplainResponse {
  matched: boolean;
  message?: string;
  suggestions?: { slug: string; name: string; subject: string }[];
  routedBy?: "keyword" | "model" | null;
  concept?: {
    id: string;
    slug: string;
    name: string;
    subject: string;
    description: string;
    commonErrors: string[];
  };
  visual?: VisualModule;
  visualCaption?: string | null;
  lesson?: LessonLine[];
  sources?: { id: string; title: string; kind: string }[];
  misconceptions?: { code: string; name: string; studentRule: string; whyItFails: string }[];
}

/** Starters that exist in the curated library, one row per subject. */
const STARTERS: Record<string, string[]> = {
  Math: ["Explain distribution", "What is factoring?", "How do inverse operations work?"],
  Physics: ["Explain kinematics", "What are Newton's laws?", "Why do units matter?"],
  Chemistry: ["Explain balancing equations", "What is a mole?", "Explain atomic structure"],
  Biology: ["Explain photosynthesis", "What is respiration?", "How does inheritance work?"],
};

/**
 * Ask about a concept, before there is any working to diagnose.
 *
 * GapFinder's diagnosis needs a chain of steps to compare. A student who does
 * not yet know where to start has none, and telling them to go and write
 * something wrong first is a strange thing for a learning tool to do.
 *
 * So this screen answers the question directly: a diagram computed from a
 * curated worked example, a lesson read aloud, and then a check. The check is
 * the point. Being explained something feels almost exactly like understanding
 * it, and the distance between those two is what the whole app exists to find.
 */
function LearnView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [subject, setSubject] = useState(searchParams.get("subject") ?? "Math");
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answered = useRef<string | null>(null);

  const speech = useSpeechInput({
    onTranscript: (text) => setQuery((current) => (current ? `${current} ${text}` : text)),
  });

  const explain = useCallback(async (text: string, subjectHint: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, subject: subjectHint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't look that up. Please try again.");
      setResult(data as ExplainResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't look that up. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Arriving with ?q= from the capture screen answers immediately, rather than
  // showing an empty box the student has to fill in a second time.
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q || answered.current === q) return;
    answered.current = q;
    void explain(q, searchParams.get("subject") ?? "Math");
  }, [searchParams, explain]);

  const concept = result?.concept;

  return (
    <div className="pb-8">
      <TopBar title="Ask a Concept" />

      <div className="px-5">
        <p className="text-center text-[13px] leading-relaxed text-ink-soft">
          Ask about anything in the library. You get a diagram, an explanation read aloud, and a check
          that it landed.
        </p>

        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 scrollbar-none">
          {SUBJECTS.map((s) => (
            <Chip
              key={s.name}
              active={subject === s.name}
              onClick={() => setSubject(s.name)}
              className="shrink-0"
            >
              {s.name}
            </Chip>
          ))}
        </div>

        <div className="mt-3 flex items-end gap-2">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void explain(query, subject);
              }}
              placeholder="Explain photosynthesis"
              aria-label="What would you like explained?"
              className="h-14 w-full rounded-2xl border border-navy-50 bg-surface-muted pl-4 pr-12 text-[15px] text-navy-900 outline-none transition-colors placeholder:text-ink-faint focus:border-lavender-400 focus:bg-surface"
            />
            {speech.supported && (
              <button
                onClick={speech.toggle}
                aria-label={speech.listening ? "Stop dictating" : "Dictate your question"}
                className={cn(
                  "absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  speech.listening ? "bg-danger text-white" : "bg-surface text-ink-soft"
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={() => void explain(query, subject)}
            loading={loading}
            disabled={!query.trim()}
            className="h-14 w-14 shrink-0 px-0"
            aria-label="Explain this"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {speech.error && <p className="mt-2 px-1 text-[11px] text-ink-faint">{speech.error}</p>}

        {!result && !loading && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(STARTERS[subject] ?? []).map((starter) => (
              <button
                key={starter}
                onClick={() => {
                  setQuery(starter);
                  void explain(starter, subject);
                }}
                className="rounded-pill bg-surface-muted px-3 py-2 text-[12px] font-medium text-navy-900 active:scale-[0.98]"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="h-28 animate-pulse rounded-card bg-surface-card" />
            <div className="h-40 animate-pulse rounded-card bg-surface-card" />
          </div>
        )}

        {/* Nothing matched. Say so, and show what the library does hold — a
            confident explanation of the wrong topic would be worse than this. */}
        {result && !result.matched && (
          <Card className="mt-4 bg-surface-muted shadow-none">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
              <AlertTriangle className="h-4 w-4 text-warning" /> Not in the library yet
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{result.message}</p>
            {result.suggestions && result.suggestions.length > 0 && (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  What we can explain
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.suggestions.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => {
                        setQuery(s.name);
                        setSubject(s.subject);
                        void explain(s.name, s.subject);
                      }}
                      className="rounded-pill bg-surface px-3 py-2 text-[12px] font-medium text-navy-900 active:scale-[0.98]"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}

        {result?.matched && concept && (
          <div className="mt-4 flex flex-col gap-3">
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-lavender-600">
                    {concept.subject}
                  </p>
                  <h2 className="mt-0.5 font-display text-xl font-bold text-navy-900">{concept.name}</h2>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender-50">
                  <Sparkles className="h-4 w-4 text-lavender-600" />
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-navy-900">{concept.description}</p>
            </Card>

            {/* The diagram is computed from a curated worked example by the same
                selector that draws a student's own verified working. */}
            {result.visual && result.visual.kind !== "none" && (
              <div className="flex flex-col gap-1.5">
                <ConceptVisual visual={result.visual} />
                {result.visualCaption && (
                  <p className="px-1 text-[11px] leading-relaxed text-ink-faint">{result.visualCaption}</p>
                )}
              </div>
            )}

            {result.lesson && result.lesson.length > 0 && <TeachMe lines={result.lesson} />}

            {result.misconceptions && result.misconceptions.length > 0 && (
              <Card className="bg-warning-50 shadow-none">
                <p className="text-xs font-semibold text-warning">Where this usually breaks</p>
                <div className="mt-2 flex flex-col gap-2.5">
                  {result.misconceptions.map((m) => (
                    <div key={m.code}>
                      <p className="text-[13px] font-semibold text-navy-900">{m.name}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{m.whyItFails}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Button onClick={() => router.push(`/exam?concept=${concept.slug}`)} className="w-full">
              <GraduationCap className="h-4 w-4" /> Check that it landed
            </Button>
            <p className="-mt-1 px-1 text-center text-[11px] leading-relaxed text-ink-faint">
              Three questions. Every wrong option is a real misconception, not filler.
            </p>

            <ResourcePanel conceptSlug={concept.slug} className="mt-1" />

            {result.sources && result.sources.length > 0 && (
              <div className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3">
                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-ink-soft">
                    Grounded in {result.sources.length} curated source
                    {result.sources.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
                    {result.sources.map((s) => s.title).join(" · ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LearnPage() {
  return (
    <Suspense
      fallback={<div className="flex h-64 items-center justify-center text-sm text-ink-soft">Loading…</div>}
    >
      <LearnView />
    </Suspense>
  );
}
