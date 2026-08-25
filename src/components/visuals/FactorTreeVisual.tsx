"use client";

/**
 * Deterministic factor-tree visual. `pairs` is a top-down list of
 * [parent, leftChild, rightChild] triples that the caller has already
 * verified multiply back to the parent — this component only draws them.
 */
export interface FactorTreeLevel {
  parent: string;
  left: string;
  right: string;
}

export function FactorTreeVisual({ levels, caption }: { levels: FactorTreeLevel[]; caption?: string }) {
  const rowH = 56;
  const height = 40 + levels.length * rowH;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 260 ${height}`} className="w-full max-w-[280px]">
        {levels.map((lvl, i) => {
          const cy = 24 + i * rowH;
          const cx = 130;
          const lx = 60;
          const rx = 200;
          const cyChild = cy + rowH - 20;
          return (
            <g key={i}>
              <line x1={cx} y1={cy + 10} x2={lx} y2={cyChild - 10} stroke="#C3B4F7" strokeWidth="2" />
              <line x1={cx} y1={cy + 10} x2={rx} y2={cyChild - 10} stroke="#C3B4F7" strokeWidth="2" />
              <circle cx={cx} cy={cy} r="20" fill="#F6F4FE" stroke="#8B5CF6" strokeWidth="2" />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight={700} fill="#151833">
                {lvl.parent}
              </text>
              {i === levels.length - 1 && (
                <>
                  <circle cx={lx} cy={cyChild} r="20" fill="#FFF6EF" stroke="#FB8A3C" strokeWidth="2" />
                  <text x={lx} y={cyChild + 4} textAnchor="middle" fontSize="12" fontWeight={700} fill="#151833">
                    {lvl.left}
                  </text>
                  <circle cx={rx} cy={cyChild} r="20" fill="#FFF6EF" stroke="#FB8A3C" strokeWidth="2" />
                  <text x={rx} y={cyChild + 4} textAnchor="middle" fontSize="12" fontWeight={700} fill="#151833">
                    {lvl.right}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      {caption && <p className="text-center text-xs text-ink-soft">{caption}</p>}
    </div>
  );
}
