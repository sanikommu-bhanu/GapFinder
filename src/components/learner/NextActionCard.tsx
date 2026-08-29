"use client";
import { useEffect, useState } from "react";
import { Signpost, ChevronDown, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * What to do next, and — if you ask — why.
 *
 * The decision itself is made server-side by a deterministic engine, so this
 * component renders a conclusion rather than reaching one. The "Why this?"
 * disclosure is the point: the reasoning is one tap away for the student who
 * wants it and invisible to the one who does not, which is the only way to put
 * this much machinery in front of someone without burying them in it.
 */

const ACTION_LABEL: Record<string, string> = {
  targeted_hint: "A hint",
  concise_explanation: "A short explanation",
  worked_example: "A worked example",
  prerequisite_review: "Go back a step",
  targeted_practice: "Practice",
  easier_diagnostic: "Something simpler",
  re_attempt: "Try again",
  transfer_problem: "A different-looking problem",
  mastery_check: "A final check",
  choose_concept: "Pick something to work on",
};

interface NextAction {
  action: string;
  reason: string;
  rule: string;
  targetConcept: { conceptId: string; slug: string; name: string } | null;
  difficulty: string;
  confidence: number;
  evidence: string[];
}

export function NextActionCard({ subject, className }: { subject?: string; className?: string }) {
  const [data, setData] = useState<NextAction | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = subject ? `/api/next-action?subject=${encodeURIComponent(subject)}` : "/api/next-action";

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: NextAction) => {
        if (cancelled) return;
        setData(json);
        setState("ready");
      })
      .catch(() => {
        // A failed recommendation must never take the page down with it. The
        // rest of the product still works without knowing what is next.
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [subject]);

  if (state === "loading") {
    return (
      <Card className={className} aria-busy="true">
        <div className="flex items-center gap-1.5">
          <Signpost className="h-3.5 w-3.5 text-ink-faint" />
          <p className="text-xs font-semibold text-ink-soft">What next</p>
        </div>
        <div className="mt-3 h-3 w-2/3 animate-pulse rounded-pill bg-surface-muted" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded-pill bg-surface-muted" />
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className={className}>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-ink-faint" />
          <p className="text-xs font-semibold text-ink-soft">What next</p>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          We could not work out your next step just now. Everything else still works — try again in a moment.
        </p>
      </Card>
    );
  }

  if (!data) return null;

  // No candidate concept: say so plainly rather than inventing a suggestion.
  if (!data.targetConcept) {
    return (
      <Card className={className}>
        <div className="flex items-center gap-1.5">
          <Signpost className="h-3.5 w-3.5 text-ink-faint" />
          <p className="text-xs font-semibold text-ink-soft">What next</p>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">{data.reason}</p>
      </Card>
    );
  }

  const label = ACTION_LABEL[data.action] ?? "Keep going";

  return (
    <Card className={className}>
      <div className="flex items-center gap-1.5">
        <Signpost className="h-3.5 w-3.5 text-ink-faint" />
        <p className="text-xs font-semibold text-ink-soft">What next</p>
      </div>

      <p className="mt-2 text-sm font-semibold text-ink">
        {label} — {data.targetConcept.name}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">{data.reason}</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-ink-soft transition-colors hover:text-ink"
      >
        Why this?
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2 border-t border-navy-50 pt-2">
          <ul className="flex flex-col gap-1">
            {data.evidence.map((line, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-ink-faint">
                • {line}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            Decided from your recorded work, not generated. Confidence{" "}
            {Math.round(data.confidence * 100)}% — this reflects how much evidence there is, and rises as
            you do more.
          </p>
        </div>
      )}
    </Card>
  );
}
