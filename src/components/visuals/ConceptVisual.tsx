"use client";

import type { VisualModule } from "@/lib/ai/visuals/select-visual";
import { BalanceEquationVisual } from "./BalanceEquationVisual";
import { NumberLineVisual } from "./NumberLineVisual";
import { DistributiveAreaVisual } from "./DistributiveAreaVisual";
import { FactorTreeVisual } from "./FactorTreeVisual";
import { FractionModelVisual } from "./FractionModelVisual";
import { CoordinatePlaneVisual } from "./CoordinatePlaneVisual";
import { AtomBalanceVisual } from "./AtomBalanceVisual";
import { PunnettSquareVisual } from "./PunnettSquareVisual";
import { ProcessFlowVisual } from "./ProcessFlowVisual";
import { AtomShellVisual } from "./AtomShellVisual";
import { CellCompareVisual } from "./CellCompareVisual";
import { CycleVisual } from "./CycleVisual";
import { LabelledPartsVisual } from "./LabelledPartsVisual";
import { ComparisonVisual } from "./ComparisonVisual";

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
      return (
        <DistributiveAreaVisual
          a={visual.a}
          b={visual.b}
          c={visual.c}
          variable={visual.variable}
          caption={visual.caption}
        />
      );
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
      return (
        <CoordinatePlaneVisual
          points={visual.points}
          range={visual.range}
          connect={visual.connect}
          xLabel={visual.xLabel}
          yLabel={visual.yLabel}
          equation={visual.equation}
          caption={visual.caption}
        />
      );
    case "atom-balance":
      return <AtomBalanceVisual left={visual.left} right={visual.right} caption={visual.caption} />;
    case "punnett":
      return (
        <PunnettSquareVisual
          parentA={visual.parentA}
          parentB={visual.parentB}
          dominant={visual.dominant}
          caption={visual.caption}
        />
      );
    case "process-flow":
      return (
        <ProcessFlowVisual
          inputs={visual.inputs}
          process={visual.process}
          location={visual.location}
          outputs={visual.outputs}
          energy={visual.energy}
          caption={visual.caption}
        />
      );
    case "atom-shells":
      return (
        <AtomShellVisual
          symbol={visual.symbol}
          name={visual.name}
          protons={visual.protons}
          neutrons={visual.neutrons}
          shells={visual.shells}
          caption={visual.caption}
        />
      );
    case "cell-compare":
      return (
        <CellCompareVisual
          shared={visual.shared}
          plantOnly={visual.plantOnly}
          animalOnly={visual.animalOnly}
          caption={visual.caption}
        />
      );
    case "cycle":
      return <CycleVisual stages={visual.stages} centre={visual.centre} caption={visual.caption} />;
    case "labelled-parts":
      return (
        <LabelledPartsVisual subject={visual.subject} parts={visual.parts} caption={visual.caption} />
      );
    case "comparison":
      return (
        <ComparisonVisual
          leftTitle={visual.leftTitle}
          rightTitle={visual.rightTitle}
          rows={visual.rows}
          caption={visual.caption}
        />
      );
    case "none":
    default:
      return null;
  }
}
