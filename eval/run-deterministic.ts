import "dotenv/config";
/**
 * Runs the fixtures in fixtures/reasoning-cases.json against the
 * deterministic math verifier ONLY (src/lib/verification/math-verifier.ts).
 * This deliberately does not touch Gemini, Prisma, or the DB, so it needs no
 * API key or migration to run — it's the fast, free layer of the eval suite
 * that should pass before ever spending a model call.
 *
 * Cases whose `note`/category require an actual image (ambiguous/messy
 * handwriting) are skipped here and reported as SKIPPED — they need real
 * image fixtures plus a configured GEMINI_API_KEY, and belong in a separate
 * end-to-end eval run once this project is set up in a real dev environment.
 *
 * Run with: npx tsx eval/run-deterministic.ts
 */
import { verifyEquationStep } from "../src/lib/verification/math-verifier";
import fixtures from "./fixtures/reasoning-cases.json";

interface Case {
  id: string;
  category: string;
  steps?: string[];
  expectFirstDivergence?: null;
  expectFirstDivergenceStep?: number;
  note?: string;
}

function findFirstDivergence(steps: string[]): number | null {
  for (let i = 1; i < steps.length; i++) {
    const { isValid } = verifyEquationStep(steps[i - 1]!, steps[i]!);
    if (!isValid) return i + 1; // 1-indexed step number of the divergent step
  }
  return null;
}

let pass = 0;
let fail = 0;
let skipped = 0;

for (const raw of fixtures.cases as Case[]) {
  if (!raw.steps) {
    console.log(`SKIP  ${raw.id} (${raw.category}) — needs an image fixture / live Gemini call`);
    skipped++;
    continue;
  }

  const got = findFirstDivergence(raw.steps);
  const expected = raw.expectFirstDivergenceStep ?? null;
  const ok = got === expected;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${raw.id.padEnd(32)} expected=${String(expected).padEnd(5)} got=${String(got)}`
  );
  if (ok) pass++;
  else fail++;
}

console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped (need image fixtures + API key).`);
if (fail > 0) process.exit(1);
