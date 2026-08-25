"use client";

/**
 * An atom drawn from its own particle counts.
 *
 * Every number on screen — the shells, how many electrons sit in each, the
 * nucleus contents — is passed in from the curated element data and drawn to
 * scale in count, not invented. The outer shell is highlighted because that is
 * the one that decides how the element behaves, which is the thing the diagram
 * exists to make obvious.
 */
export function AtomShellVisual({
  symbol,
  name,
  protons,
  neutrons,
  shells,
  caption,
}: {
  symbol: string;
  name: string;
  protons: number;
  neutrons: number;
  shells: number[];
  caption?: string;
}) {
  const size = 200;
  const centre = size / 2;
  const step = (centre - 22) / Math.max(shells.length, 1);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px]" role="img" aria-label={`${name} atom`}>
        {shells.map((count, index) => {
          const radius = 22 + step * (index + 1);
          const isOuter = index === shells.length - 1;
          return (
            <g key={index}>
              <circle
                cx={centre}
                cy={centre}
                r={radius}
                fill="none"
                stroke={isOuter ? "#F59E0B" : "#D3D5E6"}
                strokeWidth={isOuter ? 2 : 1.25}
                strokeDasharray={isOuter ? undefined : "3 3"}
              />
              {Array.from({ length: count }, (_, i) => {
                const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
                return (
                  <circle
                    key={i}
                    cx={centre + radius * Math.cos(angle)}
                    cy={centre + radius * Math.sin(angle)}
                    r="3.5"
                    fill={isOuter ? "#F59E0B" : "#8B5CF6"}
                  />
                );
              })}
            </g>
          );
        })}

        <circle cx={centre} cy={centre} r="19" fill="#151833" />
        <text x={centre} y={centre + 5} textAnchor="middle" fontSize="14" fontWeight={800} fill="#FFFFFF">
          {symbol}
        </text>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-ink-soft">
        <span>
          <span className="font-semibold text-navy-900">{protons}</span> protons
        </span>
        <span>
          <span className="font-semibold text-navy-900">{neutrons}</span> neutrons
        </span>
        <span>
          <span className="font-semibold text-navy-900">{shells.reduce((a, b) => a + b, 0)}</span> electrons ({shells.join(", ")})
        </span>
      </div>

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}
