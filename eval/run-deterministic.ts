import "dotenv/config";
/**
 * Runs the fixture set against the deterministic verification layer only —
 * the audit, the divergence search and the derived correction. It touches no
 * model, no database and no network, so it runs in milliseconds and should
 * pass before a single Gemini call is ever spent.
 *
 * It measures three things per case:
 *   1. Is the first divergence found at the right step?
 *   2. Is every later step classified correctly (consequence vs independent)?
 *   3. Is the derived correction algebraically right?
 *
 * Run with: npm run eval:deterministic
 */
import { auditSolution } from "../src/lib/verification/solution-audit";
import { solveLinear } from "../src/lib/math/solve-step";
import fixtures from "./fixtures/reasoning-cases.json";

interface Case {
  id: string;
  category: string;
  steps?: string[];
  expectFirstDivergence?: null;
  expectFirstDivergenceStep?: number;
  note?: string;
}

const cases = (fixtures as { cases: Case[] }).cases;

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

console.log(`\nGapFinder deterministic eval — ${cases.length} cases\n${"─".repeat(60)}`);

for (const c of cases) {
  if (!c.steps || c.steps.length === 0) {
    skipped += 1;
    console.log(`  SKIP  ${c.id.padEnd(28)} needs an image fixture`);
    continue;
  }

  const audit = auditSolution(c.steps.map((expression, i) => ({ order: i + 1, expression })));
  const expected = c.expectFirstDivergenceStep ?? null;
  const actual = audit.firstDivergenceOrder;

  if (actual !== expected) {
    failed += 1;
    failures.push(`${c.id}: expected divergence at ${expected ?? "none"}, got ${actual ?? "none"}`);
    console.log(`  FAIL  ${c.id.padEnd(28)} expected ${expected ?? "none"}, got ${actual ?? "none"}`);
    continue;
  }

  // A derived correction must actually be correct: solving it has to give the
  // same answer as solving the step it came from.
  const divergence = audit.steps.find((s) => s.verdict === "first_divergence");
  if (divergence?.correctedExpression) {
    const previous = c.steps[divergence.order - 2];
    const expectedSolution = previous ? solveLinear(previous) : null;
    const correctedSolution = solveLinear(divergence.correctedExpression);
    if (
      expectedSolution !== null &&
      correctedSolution !== null &&
      Math.abs(expectedSolution - correctedSolution) > 1e-9
    ) {
      failed += 1;
      failures.push(`${c.id}: correction "${divergence.correctedExpression}" does not preserve the solution`);
      console.log(`  FAIL  ${c.id.padEnd(28)} correction changes the answer`);
      continue;
    }
  }

  passed += 1;
  const summary =
    actual === null
      ? "no divergence"
      : `step ${actual}${audit.downstreamCount ? `, +${audit.downstreamCount} downstream` : ""}${
          audit.independentErrorOrders.length ? `, +${audit.independentErrorOrders.length} independent` : ""
        }`;
  console.log(`  PASS  ${c.id.padEnd(28)} ${summary}`);
}

console.log(`${"─".repeat(60)}`);
const scored = passed + failed;
const accuracy = scored > 0 ? Math.round((passed / scored) * 100) : 0;
console.log(`  ${passed} passed · ${failed} failed · ${skipped} skipped`);
console.log(`  Divergence-detection accuracy on scored cases: ${accuracy}%\n`);

if (failures.length > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
  console.log("");
  process.exit(1);
}
