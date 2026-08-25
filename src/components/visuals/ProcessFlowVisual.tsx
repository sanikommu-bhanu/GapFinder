"use client";
import { ArrowRight, ArrowDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Inputs → where it happens → outputs.
 *
 * Biology's commonest errors are directional: reactants and products swapped,
 * or a process attributed to the wrong structure. Both are hard to see in a
 * paragraph and obvious in a diagram, so the shape of the diagram is doing the
 * teaching, not the labels.
 *
 * The contents come from the curated concept data — the same human-written
 * corpus the explanations are grounded in — not from a model and not from an
 * image generator, which get scientific diagrams wrong with great confidence.
 */
export function ProcessFlowVisual({
  inputs,
  process,
  location,
  outputs,
  energy,
  caption,
}: {
  inputs: string[];
  process: string;
  /** The structure it happens in, e.g. "chloroplast". */
  location: string;
  outputs: string[];
  /** Whether the process stores or releases energy — the usual confusion. */
  energy?: { direction: "stores" | "releases"; label: string };
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-stretch gap-2">
        <Column label="Goes in" items={inputs} tone="lavender" />

        <div className="flex shrink-0 items-center">
          <ArrowRight className="h-4 w-4 text-ink-faint" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border border-navy-50 bg-surface-card p-3 text-center">
          <p className="font-display text-sm font-bold leading-tight text-navy-900">{process}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-faint">in the</p>
          <p className="text-[11px] font-semibold text-lavender-600">{location}</p>
        </div>

        <div className="flex shrink-0 items-center">
          <ArrowRight className="h-4 w-4 text-ink-faint" />
        </div>

        <Column label="Comes out" items={outputs} tone="peach" />
      </div>

      {energy && (
        <div className="flex items-center gap-2 rounded-2xl bg-surface-muted p-3">
          <ArrowDown
            className={cn(
              "h-4 w-4 shrink-0",
              energy.direction === "stores" ? "rotate-180 text-success" : "text-peach-500"
            )}
          />
          <p className="text-[11px] leading-relaxed text-navy-900">
            <span className="font-semibold">
              {energy.direction === "stores" ? "Stores" : "Releases"} energy
            </span>{" "}
            — {energy.label}
          </p>
        </div>
      )}

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}

function Column({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "lavender" | "peach";
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "truncate rounded-lg px-2 py-1.5 text-center text-[11px] font-medium",
            tone === "lavender" ? "bg-lavender-50 text-lavender-600" : "bg-peach-50 text-peach-500"
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
