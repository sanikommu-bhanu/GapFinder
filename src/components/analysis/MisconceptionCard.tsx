"use client";
import { useState } from "react";
import { Fingerprint, ChevronDown, Calculator, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * The documented misconception behind the error.
 *
 * Two things make this different from a sentence of AI-written diagnosis.
 * First, the code is drawn from a fixed catalogue, so the same error always
 * produces the same label and those labels can be counted across students.
 * Second, when the error has an algebraic signature the code is *proved* rather
 * than chosen, and the proof is one tap away — a student or a teacher can check
 * the reasoning instead of taking it on trust.
 */
export function MisconceptionCard({
  misconception,
  className,
}: {
  misconception: {
    code: string;
    basis: "proved" | "matched";
    evidence: string;
    name: string;
    studentRule: string;
    whyItFails: string;
  };
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const proved = misconception.basis === "proved";

  return (
    <Card className={cn("border border-navy-50", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Fingerprint className="h-3.5 w-3.5 text-ink-faint" />
          <p className="text-xs font-semibold text-ink-soft">Documented misconception</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold",
            proved ? "bg-success-50 text-success" : "bg-lavender-50 text-lavender-600"
          )}
          title={
            proved
              ? "Identified by an algebraic signature — no model involved."
              : "Chosen from the catalogue by the model, not proved outright."
          }
        >
          {proved ? <Calculator className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {proved ? "Proved" : "Matched"}
        </span>
      </div>

      <p className="mt-1.5 text-sm font-semibold text-navy-900">{misconception.name}</p>
      <p className="mt-1 text-[11px] font-mono uppercase tracking-wide text-ink-faint">{misconception.code}</p>

      <div className="mt-3 rounded-2xl bg-surface-muted p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">The rule you applied</p>
        <p className="mt-0.5 text-sm leading-relaxed text-navy-900">{misconception.studentRule}</p>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-navy-900">{misconception.whyItFails}</p>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 flex w-full items-center gap-1.5 text-left"
      >
        <span className="flex-1 text-[11px] font-medium text-ink-soft">
          {proved ? "How we proved it" : "How this was matched"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <p className="mt-2 border-t border-navy-50 pt-2 text-[11px] leading-relaxed text-ink-soft">
          {misconception.evidence}
        </p>
      )}
    </Card>
  );
}
