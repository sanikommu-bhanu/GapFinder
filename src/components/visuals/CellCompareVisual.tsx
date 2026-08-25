"use client";

/**
 * Plant and animal cells side by side.
 *
 * Drawn as a comparison rather than as a single labelled cell because the
 * mistake this concept actually produces is a boundary error — believing a
 * plant cell has no mitochondria because it has chloroplasts, or that a cell
 * wall and a cell membrane are the same thing. A diagram that shows one cell
 * cannot make that visible; one that shows both makes it the whole point.
 *
 * The parts are curated data passed in, not computed and not generated.
 */
export function CellCompareVisual({
  shared,
  plantOnly,
  animalOnly,
  caption,
}: {
  shared: string[];
  plantOnly: string[];
  animalOnly: string[];
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Cell title="Plant cell" outline="square" unique={plantOnly} shared={shared} />
        <Cell title="Animal cell" outline="round" unique={animalOnly} shared={shared} />
      </div>

      <div className="flex items-center justify-center gap-4">
        <Key className="bg-lavender-500" label="In both" />
        <Key className="bg-peach-500" label="Only here" />
      </div>

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}

function Cell({
  title,
  outline,
  shared,
  unique,
}: {
  title: string;
  outline: "square" | "round";
  shared: string[];
  unique: string[];
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-[11px] font-semibold text-navy-900">{title}</p>
      <div
        className={
          outline === "square"
            ? "w-full rounded-md border-[3px] border-navy-900 bg-surface-muted p-2"
            : "w-full rounded-[40%] border-2 border-navy-900 bg-surface-muted p-2 py-3"
        }
      >
        <div className="flex flex-col gap-1">
          {shared.map((part) => (
            <Part key={part} label={part} tone="bg-lavender-500" />
          ))}
          {unique.map((part) => (
            <Part key={part} label={part} tone="bg-peach-500" />
          ))}
        </div>
      </div>
      <p className="text-[9px] text-ink-faint">
        {outline === "square" ? "Rigid wall, fixed shape" : "Membrane only, flexible"}
      </p>
    </div>
  );
}

function Part({ label, tone }: { label: string; tone: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} />
      <span className="text-[10px] leading-tight text-navy-900">{label}</span>
    </span>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      <span className="text-[10px] text-ink-soft">{label}</span>
    </span>
  );
}
