"use client";
import { cn } from "@/lib/cn";

/**
 * Atom counts on both sides of a chemical equation.
 *
 * This is the diagnosis made visible. The verifier already counted every
 * element to decide whether the equation balances, so drawing those counts
 * shows the student exactly which element is short and by how much — the same
 * fact they'd get from a sentence, but findable at a glance.
 *
 * Nothing here is estimated or illustrated. Each bar is a integer count
 * produced by parsing the formula the student wrote.
 */
export function AtomBalanceVisual({
  left,
  right,
  caption,
}: {
  left: Record<string, number>;
  right: Record<string, number>;
  caption?: string;
}) {
  const elements = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  const peak = Math.max(1, ...elements.flatMap((e) => [left[e] ?? 0, right[e] ?? 0]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Reactants</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Products</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {elements.map((element) => {
          const l = left[element] ?? 0;
          const r = right[element] ?? 0;
          const balanced = l === r;

          return (
            <div key={element} className="flex items-center gap-2">
              {/* Left side grows leftward from the centre. */}
              <div className="flex flex-1 items-center justify-end gap-1.5">
                <span className={cn("text-xs font-semibold tabular-nums", balanced ? "text-ink-soft" : "text-danger")}>
                  {l}
                </span>
                <div
                  className={cn("h-5 rounded-l-md transition-all", balanced ? "bg-lavender-200" : "bg-danger/50")}
                  style={{ width: `${(l / peak) * 100}%`, minWidth: l > 0 ? "6px" : "0" }}
                />
              </div>

              <span
                className={cn(
                  "flex h-7 w-9 shrink-0 items-center justify-center rounded-md font-display text-xs font-bold",
                  balanced ? "bg-success-50 text-success" : "bg-danger-50 text-danger"
                )}
              >
                {element}
              </span>

              <div className="flex flex-1 items-center gap-1.5">
                <div
                  className={cn("h-5 rounded-r-md transition-all", balanced ? "bg-peach-200" : "bg-danger/50")}
                  style={{ width: `${(r / peak) * 100}%`, minWidth: r > 0 ? "6px" : "0" }}
                />
                <span className={cn("text-xs font-semibold tabular-nums", balanced ? "text-ink-soft" : "text-danger")}>
                  {r}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-surface-muted p-3">
        {elements.every((e) => (left[e] ?? 0) === (right[e] ?? 0)) ? (
          <p className="text-center text-xs font-medium text-success">
            Every element matches on both sides — the equation is balanced.
          </p>
        ) : (
          <p className="text-center text-xs leading-relaxed text-navy-900">
            {elements
              .filter((e) => (left[e] ?? 0) !== (right[e] ?? 0))
              .map((e) => `${e}: ${left[e] ?? 0} vs ${right[e] ?? 0}`)
              .join(" · ")}
          </p>
        )}
      </div>

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}
