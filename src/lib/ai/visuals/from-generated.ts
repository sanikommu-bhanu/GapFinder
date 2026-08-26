import type { VisualModule } from "./select-visual";
import type { GeneratedExplanation } from "@/lib/ai/pipeline/explain-concept";

/**
 * Turning a model's diagram choice into something the app can draw.
 *
 * The model picks one of four shapes and supplies the labels; every coordinate,
 * arc and connector is computed by the renderers. This is the gate between the
 * two: each branch checks the spec actually carries what its shape needs, and
 * returns `none` when it doesn't. An empty frame reads as a broken feature, and
 * a two-stage "cycle" is not a cycle whatever the model labelled it.
 */

type GeneratedDiagram = GeneratedExplanation["diagram"];

const GENERATED_CAPTION = "Shape and labels suggested by AI; the diagram itself is drawn by the app.";

export function toVisual(diagram: GeneratedDiagram, topic: string): VisualModule {
  const clean = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);

  if (diagram.kind === "process-flow") {
    const inputs = clean(diagram.inputs).slice(0, 4);
    const outputs = clean(diagram.outputs).slice(0, 4);
    if (inputs.length === 0 || outputs.length === 0) return { kind: "none" };
    return {
      kind: "process-flow",
      inputs,
      outputs,
      process: diagram.process.trim() || topic,
      location: diagram.location.trim(),
      caption: GENERATED_CAPTION,
    };
  }

  if (diagram.kind === "cycle") {
    const stages = clean(diagram.stages).slice(0, 6);
    // Fewer than three stages is not a cycle, whatever it was labelled.
    if (stages.length < 3) return { kind: "none" };
    return { kind: "cycle", stages, centre: topic, caption: GENERATED_CAPTION };
  }

  if (diagram.kind === "labelled-parts") {
    const parts = diagram.parts
      .map((p) => ({ name: p.name.trim(), role: p.role.trim() }))
      .filter((p) => p.name)
      .slice(0, 6);
    if (parts.length < 2) return { kind: "none" };
    return {
      kind: "labelled-parts",
      subject: diagram.subject.trim() || topic,
      parts,
      caption: GENERATED_CAPTION,
    };
  }

  if (diagram.kind === "comparison") {
    const rows = diagram.rows
      .map((r) => ({ aspect: r.aspect.trim(), left: r.left.trim(), right: r.right.trim() }))
      .filter((r) => r.left && r.right)
      .slice(0, 5);
    if (rows.length < 2 || !diagram.leftTitle.trim() || !diagram.rightTitle.trim()) {
      return { kind: "none" };
    }
    return {
      kind: "comparison",
      leftTitle: diagram.leftTitle.trim(),
      rightTitle: diagram.rightTitle.trim(),
      rows,
      caption: GENERATED_CAPTION,
    };
  }

  return { kind: "none" };
}
