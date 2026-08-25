"use client";

/**
 * Area model for a(bx + c).
 *
 * The rectangle is split so both terms inside the bracket are visibly part of
 * the same width — which is the whole idea a student misses when they multiply
 * only the first term. When the multiplier is negative the sign is called out
 * on each piece, because that is where the mistake usually happens.
 *
 * Every number here comes from the student's own verified expression.
 */
export function DistributiveAreaVisual({
  a,
  b,
  c,
  variable,
  caption,
}: {
  a: number;
  b: number;
  c: number;
  variable?: string;
  caption?: string;
}) {
  const v = variable ?? "";
  // Widths are proportional to the magnitudes so the split reads honestly.
  const total = Math.abs(b) + Math.abs(c) || 1;
  const wB = Math.max(48, (Math.abs(b) / total) * 200);
  const wC = Math.max(48, (Math.abs(c) / total) * 200);
  const height = 62;

  const termLabel = (coefficient: number, isVariable: boolean) => {
    if (!isVariable) return String(coefficient);
    if (coefficient === 1) return v;
    if (coefficient === -1) return `-${v}`;
    return `${coefficient}${v}`;
  };

  const productB = a * b;
  const productC = a * c;
  const insideText = `${termLabel(b, Boolean(v))} ${c < 0 ? "−" : "+"} ${Math.abs(c)}`;
  const resultText = `${termLabel(productB, Boolean(v))} ${productC < 0 ? "−" : "+"} ${Math.abs(productC)}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 280 132" className="w-full max-w-[290px]" role="img" aria-label={`${a} times ${insideText}`}>
        {/* Multiplier down the left edge. */}
        <text x="16" y={38 + height / 2} textAnchor="middle" fontSize="15" fontWeight={700} fill="rgb(21,24,51)">
          {a}
        </text>
        <line x1="30" y1="30" x2="30" y2={30 + height} stroke="rgb(160,163,189)" strokeWidth="1.5" />

        {/* Term widths across the top. */}
        <text x={40 + wB / 2} y="22" textAnchor="middle" fontSize="11" fill="rgb(107,110,138)">
          {termLabel(b, Boolean(v))}
        </text>
        <text x={40 + wB + wC / 2} y="22" textAnchor="middle" fontSize="11" fill="rgb(107,110,138)">
          {c < 0 ? `− ${Math.abs(c)}` : `+ ${c}`}
        </text>

        <rect x="40" y="30" width={wB} height={height} fill="#EDE9FD" stroke="#A78BFA" strokeWidth="2" rx="4" />
        <rect
          x={40 + wB}
          y="30"
          width={wC}
          height={height}
          fill="#FFF6EF"
          stroke="#FFB27A"
          strokeWidth="2"
          rx="4"
        />

        <text
          x={40 + wB / 2}
          y={30 + height / 2 + 5}
          textAnchor="middle"
          fontSize="13"
          fontWeight={700}
          fill="#7C4DEF"
        >
          {termLabel(productB, Boolean(v))}
        </text>
        <text
          x={40 + wB + wC / 2}
          y={30 + height / 2 + 5}
          textAnchor="middle"
          fontSize="13"
          fontWeight={700}
          fill="#D9700F"
        >
          {productC < 0 ? `−${Math.abs(productC)}` : `+${productC}`}
        </text>

        <text x="140" y="122" textAnchor="middle" fontSize="12" fill="rgb(107,110,138)">
          both pieces get multiplied by {a}
        </text>
      </svg>

      <p className="text-center font-display text-base font-semibold text-navy-900">
        {a}({insideText}) = {resultText}
      </p>
      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}
