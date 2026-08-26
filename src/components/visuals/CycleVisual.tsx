"use client";

/**
 * A closed cycle: stages arranged around a ring, in order.
 *
 * A great many topics students ask about are cycles rather than pipelines —
 * water, rock, nitrogen, the cell cycle, a feedback loop. Drawing one as a
 * left-to-right flow loses the single most important fact about it, which is
 * that the last stage feeds the first.
 *
 * Stage names are supplied; every coordinate is computed here. Nothing about
 * the geometry is guessed.
 */
export function CycleVisual({
  stages,
  centre,
  caption,
}: {
  stages: string[];
  /** What the cycle is called, printed in the middle. */
  centre?: string;
  caption?: string;
}) {
  const items = stages.filter(Boolean).slice(0, 6);
  if (items.length < 3) return null;

  const size = 260;
  const mid = size / 2;
  const radius = 88;

  const points = items.map((label, i) => {
    const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
    return {
      label,
      x: mid + radius * Math.cos(angle),
      y: mid + radius * Math.sin(angle),
      angle,
    };
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px]" role="img">
        <defs>
          <marker id="cycle-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B5CF6" />
          </marker>
        </defs>

        {/* Arcs between consecutive stages, each carrying the direction. */}
        {points.map((p, i) => {
          const next = points[(i + 1) % points.length]!;
          const gap = 0.34;
          const from = {
            x: mid + radius * Math.cos(p.angle + gap),
            y: mid + radius * Math.sin(p.angle + gap),
          };
          const to = {
            x: mid + radius * Math.cos(next.angle - gap),
            y: mid + radius * Math.sin(next.angle - gap),
          };
          return (
            <path
              key={i}
              d={`M ${from.x} ${from.y} A ${radius} ${radius} 0 0 1 ${to.x} ${to.y}`}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="1.75"
              markerEnd="url(#cycle-arrow)"
              opacity="0.75"
            />
          );
        })}

        {centre && (
          <text x={mid} y={mid + 4} textAnchor="middle" fontSize="11" fontWeight={700} fill="#151833">
            {centre.length > 18 ? `${centre.slice(0, 17)}…` : centre}
          </text>
        )}

        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="19" fill="#EDE9FE" stroke="#8B5CF6" strokeWidth="1.5" />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight={700} fill="#5B21B6">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>

      {/* The labels sit below rather than around the ring: at phone width,
          text placed on a circle either overlaps itself or shrinks past
          legibility. Numbered chips keep the mapping unambiguous. */}
      <ol className="flex w-full flex-col gap-1">
        {items.map((label, i) => (
          <li key={label} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-lavender-50 text-[10px] font-bold text-lavender-600">
              {i + 1}
            </span>
            <span className="text-[12px] leading-snug text-navy-900">{label}</span>
          </li>
        ))}
      </ol>

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}
