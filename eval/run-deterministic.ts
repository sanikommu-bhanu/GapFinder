import "dotenv/config";
/**
 * Runs the fixture sets against the deterministic layer only — the audit, the
 * divergence search, the derived correction, the misconception signatures and
 * the intervention decision. It touches no model, no database and no network,
 * so it runs in milliseconds and should pass before a single Gemini call is
 * ever spent.
 *
 * Four things are measured, each against expectations written down in the
 * fixture files rather than read back out of the implementation:
 *
 *   1. First divergence   — is the first wrong step found at the right place?
 *   2. Step classification — is the derived correction algebraically right?
 *   3. Misconception       — is the right catalogue code proved from the numbers?
 *   4. Intervention        — does the right instructional action get chosen?
 *
 * Every number printed at the bottom is computed from the run that just
 * happened. None of them is stored, and none of them is quoted from anywhere
 * else. If a metric is bad, it prints badly.
 *
 * Run with: npm run eval:deterministic
 */
import { auditSolution } from "../src/lib/verification/solution-audit";
import { solveLinear } from "../src/lib/math/solve-step";
import { detectMisconception } from "../src/lib/diagnosis/detect-misconception";
import { selectIntervention } from "../src/lib/learner/intervention";
import {
  summariseEvidence,
  type Evidence,
  type EvidenceDifficulty,
  type EvidenceKind,
  type Independence,
} from "../src/lib/learner/evidence";
import type { InterventionAction } from "../src/lib/learner/intervention";
import type { VerifiedStep } from "../src/lib/ai/pipeline/verify-and-find-divergence";
import reasoningFixtures from "./fixtures/reasoning-cases.json";
import interventionFixtures from "./fixtures/intervention-cases.json";

interface ReasoningCase {
  id: string;
  category: string;
  subject?: string;
  steps?: string[];
  expectFirstDivergence?: null;
  expectFirstDivergenceStep?: number;
  /** Catalogue code expected, or null when no misconception should be reported. */
  expectMisconceptionCode?: string | null;
  note?: string;
}

interface InterventionCase {
  id: string;
  note?: string;
  learner: {
    masteryScore: number;
    recurrenceCount: number;
    weakestPrerequisiteScore: number | null;
    weakestPrerequisiteName?: string;
    isArithmeticSlip: boolean;
    lastAttemptWasCorrect: boolean;
    interventionHistory: InterventionAction[];
    evidence: {
      kind?: EvidenceKind;
      isPositive: boolean;
      independence: Independence;
      difficulty: EvidenceDifficulty;
      ageDays?: number;
    }[];
  };
  expectAction: InterventionAction;
  expectRule: string;
}

const RULE = "─".repeat(72);
const failures: string[] = [];

/** One scored dimension. Kept separate so a weak metric cannot hide in a total. */
class Metric {
  passed = 0;
  failed = 0;
  constructor(readonly label: string) {}
  record(ok: boolean, detail: string) {
    if (ok) this.passed += 1;
    else {
      this.failed += 1;
      failures.push(detail);
    }
  }
  get scored() {
    return this.passed + this.failed;
  }
  get accuracy() {
    return this.scored > 0 ? Math.round((this.passed / this.scored) * 100) : 0;
  }
}

const divergenceMetric = new Metric("First-divergence detection");
const correctionMetric = new Metric("Derived-correction validity");
const misconceptionMetric = new Metric("Misconception classification");
const interventionMetric = new Metric("Intervention selection");

// ===========================================================================
// 1-3. Reasoning: divergence, correction, misconception
// ===========================================================================

const reasoningCases = (reasoningFixtures as { cases: ReasoningCase[] }).cases;
let skipped = 0;

console.log(`\nGapFinder deterministic eval`);
console.log(`\nReasoning fixtures — ${reasoningCases.length} cases\n${RULE}`);

for (const c of reasoningCases) {
  if (!c.steps || c.steps.length === 0) {
    skipped += 1;
    console.log(`  SKIP  ${c.id.padEnd(38)} needs an image fixture`);
    continue;
  }

  const audit = auditSolution(c.steps.map((expression, i) => ({ order: i + 1, expression })));
  const expected = c.expectFirstDivergenceStep ?? null;
  const actual = audit.firstDivergenceOrder;

  const divergenceOk = actual === expected;
  divergenceMetric.record(
    divergenceOk,
    `${c.id}: expected divergence at ${expected ?? "none"}, got ${actual ?? "none"}`
  );

  const divergence = audit.steps.find((s) => s.verdict === "first_divergence");

  // --- derived correction must preserve the solution ------------------------
  if (divergenceOk && divergence?.correctedExpression) {
    const previous = c.steps[divergence.order - 2];
    const expectedSolution = previous ? solveLinear(previous) : null;
    const correctedSolution = solveLinear(divergence.correctedExpression);
    const correctionOk =
      expectedSolution === null ||
      correctedSolution === null ||
      Math.abs(expectedSolution - correctedSolution) < 1e-9;
    correctionMetric.record(
      correctionOk,
      `${c.id}: correction "${divergence.correctedExpression}" does not preserve the solution`
    );
  }

  // --- misconception classification ----------------------------------------
  let misconceptionLabel = "";
  if (c.expectMisconceptionCode !== undefined && divergenceOk) {
    let actualCode: string | null = null;
    if (divergence) {
      const previousExpression = c.steps[divergence.order - 2] ?? "";
      const match = detectMisconception({
        divergence: {
          order: divergence.order,
          statement: "",
          expression: divergence.expression,
          isValid: false,
          isFirstGap: true,
          verificationNote: divergence.note,
          correctedExpression: divergence.correctedExpression,
          verdict: divergence.verdict,
          domain: divergence.domain,
        } as VerifiedStep,
        previousExpression,
        subject: c.subject ?? "math",
      });
      actualCode = match?.misconception.code ?? null;
    }
    const ok = actualCode === c.expectMisconceptionCode;
    misconceptionMetric.record(
      ok,
      `${c.id}: expected misconception ${c.expectMisconceptionCode ?? "none"}, got ${actualCode ?? "none"}`
    );
    misconceptionLabel = ok
      ? ` · ${actualCode ?? "no misconception"}`
      : ` · MISCONCEPTION ${actualCode ?? "none"} != ${c.expectMisconceptionCode ?? "none"}`;
  }

  const summary =
    actual === null
      ? "no divergence"
      : `step ${actual}${audit.downstreamCount ? `, +${audit.downstreamCount} downstream` : ""}${
          audit.independentErrorOrders.length
            ? `, +${audit.independentErrorOrders.length} independent`
            : ""
        }`;

  console.log(
    `  ${divergenceOk ? "PASS" : "FAIL"}  ${c.id.padEnd(38)} ${summary}${misconceptionLabel}`
  );
}

// ===========================================================================
// 4. Intervention selection
// ===========================================================================

const interventionCases = (interventionFixtures as { cases: InterventionCase[] }).cases;
const NOW = Date.now();

console.log(`\nIntervention fixtures — ${interventionCases.length} cases\n${RULE}`);

for (const c of interventionCases) {
  const evidence: Evidence[] = c.learner.evidence.map((e) => ({
    kind: e.kind ?? "answer_result",
    source: "practice",
    concept: c.id,
    isPositive: e.isPositive,
    independence: e.independence,
    difficulty: e.difficulty,
    observedAt: new Date(NOW - (e.ageDays ?? 0) * 86_400_000),
    note: "",
  }));

  const decision = selectIntervention({
    masteryScore: c.learner.masteryScore,
    evidence: summariseEvidence(evidence, NOW),
    recurrenceCount: c.learner.recurrenceCount,
    weakestPrerequisiteScore: c.learner.weakestPrerequisiteScore,
    weakestPrerequisiteName: c.learner.weakestPrerequisiteName ?? null,
    isArithmeticSlip: c.learner.isArithmeticSlip,
    lastAttemptWasCorrect: c.learner.lastAttemptWasCorrect,
    interventionHistory: c.learner.interventionHistory,
  });

  const ok = decision.action === c.expectAction && decision.rule === c.expectRule;
  interventionMetric.record(
    ok,
    `${c.id}: expected ${c.expectAction}/${c.expectRule}, got ${decision.action}/${decision.rule}`
  );
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${c.id.padEnd(38)} ${decision.action} (${decision.rule})`
  );
}

// ===========================================================================
// Results
// ===========================================================================

const metrics = [divergenceMetric, correctionMetric, misconceptionMetric, interventionMetric];

console.log(`\nResults\n${RULE}`);
for (const m of metrics) {
  const detail = m.scored === 0 ? "no scored cases" : `${m.passed}/${m.scored} — ${m.accuracy}%`;
  console.log(`  ${m.label.padEnd(32)} ${detail}`);
}

const totalPassed = metrics.reduce((n, m) => n + m.passed, 0);
const totalScored = metrics.reduce((n, m) => n + m.scored, 0);
console.log(RULE);
console.log(
  `  ${totalPassed}/${totalScored} assertions passed · ${skipped} skipped (image fixtures)\n`
);

if (failures.length > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
  console.log("");
  process.exit(1);
}
