"use client";
import { cn } from "@/lib/cn";

/**
 * A Punnett square, computed rather than illustrated.
 *
 * Genetics is one of the few places in biology where the answer is arithmetic:
 * cross two genotypes and the offspring ratios follow with certainty. So this
 * is derived the same way the algebra visuals are — every cell is the pairing
 * of one allele from each parent, and the ratio underneath is a count of those
 * cells, not an estimate.
 *
 * It also separates the two things students most often merge: the genotype grid
 * above, and the phenotype ratio below, which are different questions with
 * different answers.
 */
export function PunnettSquareVisual({
  parentA,
  parentB,
  dominant,
  caption,
}: {
  /** Alleles of the first parent, e.g. ["A", "a"]. */
  parentA: string[];
  parentB: string[];
  /** The dominant allele symbol — uppercase by convention. */
  dominant: string;
  caption?: string;
}) {
  // Each cell pairs one allele from each parent, dominant written first.
  const cells = parentB.map((b) =>
    parentA.map((a) => {
      const pair = [a, b].sort((x, y) => (x === dominant ? -1 : y === dominant ? 1 : x.localeCompare(y)));
      return pair.join("");
    })
  );

  const flat = cells.flat();
  const genotypeCounts = new Map<string, number>();
  for (const g of flat) genotypeCounts.set(g, (genotypeCounts.get(g) ?? 0) + 1);

  const showsDominant = flat.filter((g) => g.includes(dominant)).length;
  const showsRecessive = flat.length - showsDominant;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[260px]">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `2rem repeat(${parentA.length}, minmax(0, 1fr))` }}
        >
          <span />
          {parentA.map((a, i) => (
            <span key={`ha-${i}`} className="text-center font-display text-sm font-bold text-lavender-600">
              {a}
            </span>
          ))}

          {cells.map((row, rowIndex) => (
            <>
              <span
                key={`hb-${rowIndex}`}
                className="flex items-center justify-center font-display text-sm font-bold text-peach-500"
              >
                {parentB[rowIndex]}
              </span>
              {row.map((genotype, colIndex) => {
                const isDominantPhenotype = genotype.includes(dominant);
                return (
                  <span
                    key={`c-${rowIndex}-${colIndex}`}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg border font-display text-sm font-bold",
                      isDominantPhenotype
                        ? "border-lavender-200 bg-lavender-50 text-navy-900"
                        : "border-navy-50 bg-surface-muted text-ink-soft"
                    )}
                  >
                    {genotype}
                  </span>
                );
              })}
            </>
          ))}
        </div>
      </div>

      <div className="w-full rounded-2xl bg-surface-muted p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Genotype</p>
        <p className="mt-0.5 font-display text-sm text-navy-900">
          {Array.from(genotypeCounts.entries())
            .map(([g, n]) => `${n} ${g}`)
            .join(" : ")}
        </p>

        <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Phenotype</p>
        <p className="mt-0.5 font-display text-sm text-navy-900">
          {showsDominant} showing dominant : {showsRecessive} showing recessive
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
          Different genotypes can give the same phenotype — which is why the two ratios differ.
        </p>
      </div>

      {caption && <p className="text-center text-xs leading-relaxed text-ink-soft">{caption}</p>}
    </div>
  );
}
