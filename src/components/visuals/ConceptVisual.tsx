"use client";

import type { VisualModule } from "@/lib/ai/visuals/select-visual";
import { BalanceEquationVisual } from "./BalanceEquationVisual";
import { NumberLineVisual } from "./NumberLineVisual";
import { DistributiveAreaVisual } from "./DistributiveAreaVisual";
import { FactorTreeVisual } from "./FactorTreeVisual";
import { FractionModelVisual } from "./FractionModelVisual";
import { CoordinatePlaneVisual } from "./CoordinatePlaneVisual";

/**
 * Renders the deterministic visual module chosen by selectConceptVisual().
 * Returns null for `{ kind: "none" }` so the caller can fall back to its
 * existing plain-text explanation card — never a blank or broken diagram.
 */
export function ConceptVisual({ visual }: { visual: VisualModule }) {
  switch (visual.kind) {
    case "balance":
      return <BalanceEquationVisual steps={visual.steps} caption={visual.caption} />;
    case "number-line":
      return <NumberLineVisual from={visual.from} to={visual.to} caption={visual.caption} />;
    case "distributive-area":
      return <DistributiveAreaVisual a={visual.a} b={visual.b} c={visual.c} caption={visual.caption} />;
    case "factor-tree":
      return <FactorTreeVisual levels={visual.levels} caption={visual.caption} />;
    case "fraction":
      return (
        <FractionModelVisual
          numerator={visual.numerator}
          denominator={visual.denominator}
          label={visual.label}
          caption={visual.caption}
        />
      );
    case "coordinate-plane":
      return <CoordinatePlaneVisual points={visual.points} range={visual.range} caption={visual.caption} />;
    case "none":
    default:
      return null;
  }
}
