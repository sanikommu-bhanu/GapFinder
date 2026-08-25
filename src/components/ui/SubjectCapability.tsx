"use client";
import { useState } from "react";
import { Check, Eye, ChevronDown } from "lucide-react";
import { getSubject } from "@/lib/subjects";
import { cn } from "@/lib/cn";

/**
 * States what GapFinder will actually do with this subject's work.
 *
 * The distinction matters: a proved step is checked by arithmetic and is right
 * if it passes; a reviewed one is read by AI against curated notes and is
 * useful but not proof. Collapsing that difference would let a student believe
 * their biology essay had been verified the way their algebra was.
 */
export function SubjectCapability({ subject, className }: { subject: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const meta = getSubject(subject);

  return (
    <div className={cn("rounded-2xl bg-surface-muted p-3", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 text-left"
      >
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
        <span className="flex-1 text-[11px] leading-relaxed text-ink-soft">{meta.note}</span>
        <ChevronDown
          className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-navy-50 pt-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-success">
              <Check className="h-3 w-3" /> Proved
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {meta.proves.map((item) => (
                <li key={item} className="text-[11px] leading-relaxed text-navy-900">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              <Eye className="h-3 w-3" /> Reviewed, not proved
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {meta.reviews.map((item) => (
                <li key={item} className="text-[11px] leading-relaxed text-ink-soft">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
