"use client";
import { cn } from "@/lib/cn";

/**
 * Two things set against each other, row by row.
 *
 * Whenever a student asks "what is the difference between X and Y" — mitosis
 * and meiosis, series and parallel, speed and velocity — the answer is a set of
 * paired contrasts, and a paragraph is the wrong shape for it. Aligning the
 * pairs is what makes the difference visible rather than merely stated.
 */
export function ComparisonVisual({
  leftTitle,
  rightTitle,
  rows,
  caption,
}: {
  leftTitle: string;
  rightTitle: string;
  rows: { aspect: string; left: string; right: string }[];
  caption?: string;
}) {
  const items = rows.filter((r) => r.left || r.right).slice(0, 5);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        {[leftTitle, rightTitle].map((title, i) => (
          <p
            key={title}
            className={cn(
              "rounded-xl px-2.5 py-2 text-center text-[12px] font-bold",
              i === 0 ? "bg-lavender-50 text-lavender-600" : "bg-peach-50 text-peach-500"
            )}
          >
            {title}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {items.map((row) => (
          <div key={row.aspect} className="flex flex-col gap-1">
            {row.aspect && (
              <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                {row.aspect}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <p className="rounded-xl bg-surface-muted p-2.5 text-[11px] leading-snug text-navy-900">
                {row.left}
              </p>
              <p className="rounded-xl bg-surface-muted p-2.5 text-[11px] leading-snug text-navy-900">
                {row.right}
              </p>
            </div>
          </div>
        ))}
      </div>

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}
