/**
 * GapFinder seed script
 * Populates: concept knowledge graph, RAG knowledge chunks, achievement
 * definitions, and one deterministic Demo Mode fixture (isDemo user +
 * full pre-populated journey) so the app is fully explorable with
 * zero live Gemini calls.
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// 1. CONCEPT KNOWLEDGE GRAPH
// ---------------------------------------------------------------------------
// Algebra -> Equations -> Inverse Operations -> Sign Handling -> Distribution
//                                             -> Factoring -> Quadratics
const concepts = [
  {
    slug: "algebra",
    name: "Algebra",
    subject: "Math",
    description:
      "The branch of math that uses letters and symbols to represent numbers and quantities in formulas and equations.",
    commonErrors: ["Treating variables as labels instead of unknown quantities"],
  },
  {
    slug: "equations",
    name: "Equations",
    subject: "Math",
    description:
      "A statement that two expressions are equal, solved by isolating the unknown variable.",
    commonErrors: [
      "Not applying the same operation to both sides",
      "Losing track of the equals-sign balance",
    ],
  },
  {
    slug: "inverse-operations",
    name: "Inverse Operations",
    subject: "Math",
    description:
      "Undoing an operation with its opposite (addition/subtraction, multiplication/division) to isolate a variable.",
    commonErrors: [
      "Applying the inverse operation inconsistently to both sides",
      "Adding instead of subtracting (or vice versa)",
      "Forgetting to invert an operation at all",
    ],
  },
  {
    slug: "sign-handling",
    name: "Sign Handling",
    subject: "Math",
    description:
      "Correctly tracking positive and negative signs when moving terms across the equals sign or distributing.",
    commonErrors: [
      "Dropping a negative sign when moving a term",
      "Flipping a sign that shouldn't change",
      "Double-negative confusion",
    ],
  },
  {
    slug: "distribution",
    name: "Distribution",
    subject: "Math",
    description:
      "Multiplying a single term by each term inside a parenthesis: a(b + c) = ab + ac.",
    commonErrors: [
      "Only multiplying the first term inside the parenthesis",
      "Sign errors when distributing a negative coefficient",
    ],
  },
  {
    slug: "factoring",
    name: "Factoring",
    subject: "Math",
    description:
      "Rewriting an expression as a product of simpler terms, the reverse of distribution.",
    commonErrors: [
      "Choosing factor pairs that don't multiply to the constant term",
      "Sign mismatches between factor pairs",
    ],
  },
  {
    slug: "quadratics",
    name: "Quadratics",
    subject: "Math",
    description:
      "Equations of the form ax^2 + bx + c = 0, solved by factoring, completing the square, or the quadratic formula.",
    commonErrors: [
      "Misapplying the quadratic formula's sign in -b",
      "Forgetting the +/- when taking a square root",
    ],
  },
  {
    slug: "fractions",
    name: "Fractions",
    subject: "Math",
    description:
      "Representing and operating on parts of a whole, including simplifying, adding, and comparing fractions with a shared or different denominator.",
    commonErrors: [
      "Adding numerators and denominators straight across instead of finding a common denominator",
      "Failing to simplify the final fraction to lowest terms",
      "Treating a larger denominator as always meaning a larger fraction",
    ],
  },
  {
    slug: "linear-graphing",
    name: "Graphing Linear Equations",
    subject: "Math",
    description:
      "Plotting an equation in slope-intercept form (y = mx + b) on the coordinate plane by identifying the y-intercept and using the slope to find a second point.",
    commonErrors: [
      "Swapping the roles of slope and y-intercept",
      "Plotting the y-intercept on the x-axis or vice versa",
      "Miscounting rise/run when applying the slope",
    ],
  },
];

const relationships: [string, string, string][] = [
  ["algebra", "equations", "prerequisite"],
  ["equations", "inverse-operations", "prerequisite"],
  ["inverse-operations", "sign-handling", "prerequisite"],
  ["sign-handling", "distribution", "prerequisite"],
  ["distribution", "factoring", "prerequisite"],
  ["factoring", "quadratics", "prerequisite"],
  ["sign-handling", "factoring", "related"],
  ["algebra", "fractions", "prerequisite"],
  ["fractions", "equations", "related"],
  ["equations", "linear-graphing", "builds-on"],
  ["linear-graphing", "quadratics", "related"],
  // Reverse operations of each other — students frequently apply one
  // procedure when the other was called for.
  ["distribution", "factoring", "commonly-confused-with"],
];

// ---------------------------------------------------------------------------
// 2. CURATED RAG KNOWLEDGE CHUNKS
// ---------------------------------------------------------------------------
type ChunkSeed = {
  concept: string;
  kind: "explanation" | "worked_example" | "misconception" | "teaching_strategy" | "practice_pattern";
  title: string;
  content: string;
  keywords: string[];
};

const chunks: ChunkSeed[] = [
  {
    concept: "inverse-operations",
    kind: "explanation",
    title: "What an inverse operation actually undoes",
    content:
      "Every operation has an opposite that cancels it out: addition undoes subtraction, multiplication undoes division. To isolate a variable, apply the inverse of whatever is being done to it, and apply that exact same inverse to both sides of the equation so the balance is preserved.",
    keywords: ["inverse", "opposite", "undo", "isolate", "both sides"],
  },
  {
    concept: "inverse-operations",
    kind: "misconception",
    title: "Applying the inverse to only one side",
    content:
      "A common misconception is subtracting a value from one side but forgetting to subtract it from the other, which breaks the equality. Students often do this when the operation 'looks finished' on the side they're focused on.",
    keywords: ["one side", "unbalanced", "forgot", "both sides"],
  },
  {
    concept: "inverse-operations",
    kind: "worked_example",
    title: "Isolating x in 2x + 7 = 15",
    content:
      "Subtract 7 from both sides: 2x = 8. Then divide both sides by 2: x = 4. Each step undoes the operation closest to the variable first, working outward.",
    keywords: ["2x+7", "worked example", "step by step"],
  },
  {
    concept: "inverse-operations",
    kind: "teaching_strategy",
    title: "Use a balance-scale mental model",
    content:
      "Picture the equation as a balance scale: whatever you remove from one pan, you must remove from the other or the scale tips. This concrete image helps students internalize why both sides need the same operation.",
    keywords: ["balance", "scale", "visual", "model"],
  },
  {
    concept: "sign-handling",
    kind: "explanation",
    title: "Why signs flip when moving terms",
    content:
      "Moving a term across the equals sign is really subtracting it from both sides, which is why a positive term becomes negative on the other side. The sign doesn't 'flip' by rule — it changes because of the subtraction being applied.",
    keywords: ["sign flip", "move term", "negative", "cross the equals"],
  },
  {
    concept: "sign-handling",
    kind: "misconception",
    title: "Dropping the negative sign",
    content:
      "Students frequently rewrite -7 as 7 when isolating a term, especially under time pressure. The error usually happens at the exact step where a term crosses the equals sign, not in the arithmetic that follows.",
    keywords: ["dropped sign", "negative", "lost minus"],
  },
  {
    concept: "sign-handling",
    kind: "worked_example",
    title: "Solving 2x = 15 - 7",
    content:
      "2x = 15 - 7 simplifies to 2x = 8, not 2x = 22. Combine the constant terms on the same side carefully, keeping each term's sign attached to it as it moves.",
    keywords: ["2x=15-7", "combine terms", "constants"],
  },
  {
    concept: "distribution",
    kind: "explanation",
    title: "Distributing across every term",
    content:
      "a(b + c) means a multiplies both b and c individually, producing ab + ac. Every term inside the parenthesis must be multiplied, not just the first one.",
    keywords: ["distribute", "parenthesis", "multiply each term"],
  },
  {
    concept: "distribution",
    kind: "misconception",
    title: "Only distributing to the first term",
    content:
      "A frequent error is multiplying the outside term by only the first term in the parenthesis and simply copying the second term unchanged.",
    keywords: ["first term only", "partial distribution"],
  },
  {
    concept: "distribution",
    kind: "worked_example",
    title: "Expanding -3(x - 4)",
    content:
      "-3(x - 4) = -3x + 12. The negative sign on -3 must be distributed to both terms, flipping the sign of -4 to +12.",
    keywords: ["negative distribution", "-3(x-4)"],
  },
  {
    concept: "factoring",
    kind: "explanation",
    title: "Factoring as reverse distribution",
    content:
      "Factoring finds two terms that, when distributed, reproduce the original expression. For x^2 + bx + c, look for two numbers that multiply to c and add to b.",
    keywords: ["factor pairs", "reverse distribution", "x^2+bx+c"],
  },
  {
    concept: "factoring",
    kind: "misconception",
    title: "Picking factors that add instead of multiply to c",
    content:
      "Students sometimes search for two numbers that sum to c rather than multiply to c, mixing up which condition applies to which coefficient.",
    keywords: ["sum vs product", "factor pair confusion"],
  },
  {
    concept: "factoring",
    kind: "practice_pattern",
    title: "Factor-pair table strategy",
    content:
      "List all factor pairs of the constant term, then check which pair sums to the middle coefficient. This systematic table avoids trial-and-error guessing.",
    keywords: ["factor table", "systematic", "strategy"],
  },
  {
    concept: "quadratics",
    kind: "explanation",
    title: "The quadratic formula's sign structure",
    content:
      "In x = (-b ± √(b²-4ac)) / 2a, the sign of b is inverted before the rest of the formula is applied, which is a frequent source of sign errors.",
    keywords: ["quadratic formula", "-b", "sign"],
  },
  {
    concept: "quadratics",
    kind: "misconception",
    title: "Forgetting the ± when taking a square root",
    content:
      "When solving by taking a square root directly, students often keep only the positive root and miss the negative solution.",
    keywords: ["plus minus", "square root", "two solutions"],
  },
  {
    concept: "equations",
    kind: "teaching_strategy",
    title: "Verify by substitution",
    content:
      "After solving, substitute the answer back into the original equation to confirm both sides are equal. This habit catches sign and arithmetic errors before they compound.",
    keywords: ["check answer", "substitute", "verify"],
  },
  {
    concept: "fractions",
    kind: "explanation",
    title: "Why fractions need a common denominator to add",
    content:
      "A fraction's denominator defines the size of each part, so two fractions can only be combined directly once their parts are the same size. Finding a common denominator rescales both fractions to matching part-sizes before the numerators are added.",
    keywords: ["common denominator", "add fractions", "equivalent fractions"],
  },
  {
    concept: "fractions",
    kind: "misconception",
    title: "Adding straight across",
    content:
      "Students often add numerator to numerator and denominator to denominator without finding a common denominator first, producing a fraction that doesn't represent the correct total.",
    keywords: ["straight across", "wrong denominator", "add numerators"],
  },
  {
    concept: "fractions",
    kind: "worked_example",
    title: "Adding 1/4 + 1/2",
    content:
      "Rewrite 1/2 as 2/4 so both fractions share a denominator of 4. Then 1/4 + 2/4 = 3/4, which is already in lowest terms.",
    keywords: ["1/4+1/2", "worked example", "lowest terms"],
  },
  {
    concept: "linear-graphing",
    kind: "explanation",
    title: "Reading slope-intercept form",
    content:
      "In y = mx + b, b is the y-intercept — where the line crosses the y-axis — and m is the slope, describing how many units y changes for each unit x increases. Plot b first, then use m as rise-over-run to find a second point.",
    keywords: ["slope intercept", "y=mx+b", "slope", "y-intercept"],
  },
  {
    concept: "linear-graphing",
    kind: "misconception",
    title: "Swapping slope and y-intercept",
    content:
      "A frequent error is plotting the slope value on the y-axis and using the intercept as the rise-over-run, which produces a line with the correct steepness in the wrong position or the correct position at the wrong angle.",
    keywords: ["swapped slope", "wrong intercept", "confused m and b"],
  },
  {
    concept: "linear-graphing",
    kind: "worked_example",
    title: "Graphing y = 2x + 1",
    content:
      "Start at the y-intercept (0, 1). The slope 2 means rise 2, run 1, so the next point is (1, 3). Draw a line through both points.",
    keywords: ["y=2x+1", "worked example", "rise over run"],
  },
];

// ---------------------------------------------------------------------------
// 3. ACHIEVEMENTS (machine-checkable criteria)
// ---------------------------------------------------------------------------
// NOTE: criteria shape { stat, min } matches the machine-checkable evaluator
// in src/lib/services/achievements-service.ts (checkAndUnlockAchievements).
const achievements = [
  {
    slug: "first-gap",
    title: "First Gap",
    description: "Found your first learning gap.",
    icon: "target",
    criteria: JSON.stringify({ stat: "gapsFound", min: 1 }),
  },
  {
    slug: "gap-master",
    title: "Gap Master",
    description: "Repaired 5 gaps.",
    icon: "award",
    criteria: JSON.stringify({ stat: "gapsRepaired", min: 5 }),
  },
  {
    slug: "transfer-pro",
    title: "Transfer Pro",
    description: "Transferred 5 concepts to new problems.",
    icon: "shuffle",
    criteria: JSON.stringify({ stat: "transfersSucceeded", min: 5 }),
  },
  {
    slug: "teach-back",
    title: "Teach Back",
    description: "Explained 5 concepts back correctly.",
    icon: "message-circle",
    criteria: JSON.stringify({ stat: "teachBacks", min: 1 }),
  },
  {
    slug: "streak-7",
    title: "7-Day Streak",
    description: "Studied 7 days in a row.",
    icon: "flame",
    criteria: JSON.stringify({ stat: "streakDays", min: 7 }),
  },
];

async function main() {
  console.log("Seeding concepts...");
  const conceptMap: Record<string, string> = {};
  for (const c of concepts) {
    const row = await prisma.concept.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        subject: c.subject,
        description: c.description,
        commonErrors: JSON.stringify(c.commonErrors),
      },
      create: {
        slug: c.slug,
        name: c.name,
        subject: c.subject,
        description: c.description,
        commonErrors: JSON.stringify(c.commonErrors),
      },
    });
    conceptMap[c.slug] = row.id;
  }

  console.log("Seeding concept relationships...");
  for (const [from, to, type] of relationships) {
    await prisma.conceptRelationship.upsert({
      where: {
        fromId_toId_relationType: {
          fromId: conceptMap[from],
          toId: conceptMap[to],
          relationType: type,
        },
      },
      update: {},
      create: {
        fromId: conceptMap[from],
        toId: conceptMap[to],
        relationType: type,
      },
    });
  }

  console.log("Seeding RAG knowledge chunks...");
  // Idempotency: clear existing chunks for these concepts, then insert fresh.
  await prisma.knowledgeChunk.deleteMany({
    where: { conceptId: { in: Object.values(conceptMap) } },
  });
  for (const ch of chunks) {
    await prisma.knowledgeChunk.create({
      data: {
        conceptId: conceptMap[ch.concept],
        kind: ch.kind,
        title: ch.title,
        content: ch.content,
        keywords: JSON.stringify(ch.keywords),
      },
    });
  }

  console.log("Seeding achievements...");
  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      update: { title: a.title, description: a.description, icon: a.icon, criteria: a.criteria },
      create: a,
    });
  }

  console.log("Seeding demo fixture...");
  await seedDemoFixture(conceptMap);

  console.log("Seed complete.");
}

// ---------------------------------------------------------------------------
// 4. DEMO MODE FIXTURE
// ---------------------------------------------------------------------------
// A single deterministic user + full journey so the whole app can be toured
// without any live Gemini calls. Flagged via analysis.isDemo (see note below
// on the schema field required for this — see README "Known limitations"
// if the migration hasn't been applied yet).
async function seedDemoFixture(conceptMap: Record<string, string>) {
  const demoEmail = "demo@gapfinder.app";
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash,
      name: "Emma Wilson",
      profile: {
        create: {
          gradeLevel: "High School",
          subjects: JSON.stringify(["Math"]),
          isPremium: true,
          streakDays: 7,
          lastActiveAt: new Date(),
        },
      },
      studyPreference: { create: {} },
      settings: { create: {} },
    },
  });

  const inverseOpsId = conceptMap["inverse-operations"];
  const signId = conceptMap["sign-handling"];

  // Mastery records matching the reference UI (Overall 78%, per-concept bars)
  const masteryData: [string, number][] = [
    ["inverse-operations", 100],
    ["sign-handling", 61],
    ["distribution", 88],
    ["factoring", 92],
    ["quadratics", 72],
  ];
  for (const [slug, score] of masteryData) {
    await prisma.masteryRecord.upsert({
      where: { userId_conceptId: { userId: user.id, conceptId: conceptMap[slug] } },
      update: { masteryScore: score, trend: "up" },
      create: {
        userId: user.id,
        conceptId: conceptMap[slug],
        masteryScore: score,
        trend: "up",
        history: JSON.stringify([{ date: new Date().toISOString(), score }]),
      },
    });
  }

  // The curated demo problem: 2x + 7 = 15, worked incorrectly as
  // 2x = 15 + 7 (sign error) instead of 2x = 15 - 7.
  const analysis = await prisma.analysis.upsert({
    where: { id: "demo-analysis-1" },
    update: {},
    create: {
      id: "demo-analysis-1",
      userId: user.id,
      subject: "Math",
      status: "complete",
      confidence: "high",
      isDemo: true,
      completedAt: new Date(),
    },
  });

  await prisma.uploadedWork.upsert({
    where: { analysisId: analysis.id },
    update: {},
    create: {
      analysisId: analysis.id,
      // Curated handwritten-work reference image bundled with the app
      // (public/demo/handwriting-sample.png — see README).
      imageUrl: "/demo/handwriting-sample.png",
      sourceType: "camera",
      rawText: "2x + 7 = 15\n2x = 15 + 7\nx = 11",
      width: 900,
      height: 1200,
    },
  });

  const extractedStepsData = [
    { order: 1, rawLine: "2x + 7 = 15", interpreted: "2x + 7 = 15", confidence: "high" },
    { order: 2, rawLine: "2x = 15 + 7", interpreted: "2x = 15 + 7", confidence: "high" },
    { order: 3, rawLine: "x = 11", interpreted: "x = 11", confidence: "high" },
  ];
  for (const s of extractedStepsData) {
    await prisma.extractedStep
      .upsert({
        where: { id: `demo-extracted-${s.order}` },
        update: {},
        create: { id: `demo-extracted-${s.order}`, analysisId: analysis.id, ...s },
      })
      .catch(() => null);
  }

  // Matches the "Reasoning Replay" reference screen: steps 1-2 valid,
  // step 3 marked as the first divergence (isFirstGap), steps 4-6 the
  // downstream consequence chain.
  const reasoningStepsData = [
    { order: 1, statement: "2x + 7 = 15", expression: "2x + 7 = 15", isValid: true, isFirstGap: false },
    { order: 2, statement: "2x = 15 + 7", expression: "2x = 15 + 7", isValid: true, isFirstGap: false },
    {
      order: 3,
      statement: "x = 11",
      expression: "x = 11",
      isValid: false,
      isFirstGap: true,
      verificationNote: "Should be 2x = 15 - 7 (subtract 7 from both sides), not add 7.",
    },
    {
      order: 4,
      statement: "First Divergence: 2x = 15 + 7",
      expression: "2x = 15 + 7",
      isValid: false,
      isFirstGap: false,
      verificationNote: "You wrote 2x = 15 + 7, but it should be 2x = 15 - 7.",
    },
    {
      order: 5,
      statement: "Consequence carries through to the final answer",
      expression: "x = 11",
      isValid: false,
      isFirstGap: false,
    },
    {
      order: 6,
      statement: "Correct final answer",
      expression: "x = 4",
      isValid: true,
      isFirstGap: false,
    },
  ];
  for (const s of reasoningStepsData) {
    await prisma.reasoningStep
      .upsert({
        where: { id: `demo-reasoning-${s.order}` },
        update: {},
        create: { id: `demo-reasoning-${s.order}`, analysisId: analysis.id, ...s },
      })
      .catch(() => null);
  }

  const gap = await prisma.gap
    .upsert({
      where: { id: "demo-gap-1" },
      update: {},
      create: {
        id: "demo-gap-1",
        analysisId: analysis.id,
        conceptId: signId,
        classification: "sign-error",
        surfaceError: "Wrote 2x = 15 + 7 instead of 2x = 15 - 7",
        underlyingGap:
          "Applies the inverse operation inconsistently — subtracted on paper but added when isolating the variable.",
        evidence: JSON.stringify([{ stepId: "demo-step-2", note: "Sign changed from - to +" }]),
        confidence: "high",
        explanationText:
          "You changed '+7' to '+7' instead of applying the inverse operation (-7) to both sides.",
        status: "repaired",
      },
    })
    .catch(() => null);

  if (gap) {
    const problem = await prisma.practiceProblem
      .upsert({
        where: { id: "demo-problem-1" },
        update: {},
        create: {
          id: "demo-problem-1",
          conceptId: signId,
          difficulty: "repair",
          prompt: "4x - 9 = 27",
          correctAnswer: "x = 9",
          isGenerated: false,
        },
      })
      .catch(() => null);

    if (problem) {
      await prisma.practiceAttempt
        .upsert({
          where: { id: "demo-practice-1" },
          update: {},
          create: {
            id: "demo-practice-1",
            gapId: gap.id,
            problemId: problem.id,
            studentSteps: "4x = 27 + 9\n4x = 36\nx = 9",
            isCorrect: true,
            verifiedBy: "deterministic",
            feedback: "Correctly applied the inverse operation to both sides.",
          },
        })
        .catch(() => null);
    }

    const transferProblem = await prisma.practiceProblem
      .upsert({
        where: { id: "demo-transfer-problem-1" },
        update: {},
        create: {
          id: "demo-transfer-problem-1",
          conceptId: signId,
          difficulty: "transfer",
          prompt: "7 + 3x = 25",
          correctAnswer: "x = 6",
          isGenerated: false,
        },
      })
      .catch(() => null);

    if (transferProblem) {
      await prisma.transferAttempt
        .upsert({
          where: { id: "demo-transfer-1" },
          update: {},
          create: {
            id: "demo-transfer-1",
            gapId: gap.id,
            problemId: transferProblem.id,
            studentSteps: "3x = 25 - 7\n3x = 18\nx = 6",
            isCorrect: true,
            verifiedBy: "deterministic",
            feedback: "Applied the same inverse-operation reasoning to a new equation layout.",
          },
        })
        .catch(() => null);
    }

    await prisma.teachBackAttempt
      .upsert({
        where: { id: "demo-teachback-1" },
        update: {},
        create: {
          id: "demo-teachback-1",
          gapId: gap.id,
          studentExplanation:
            "We subtract 7 from both sides because we need to keep the equation balanced.",
          inputMode: "voice",
          rubricScore: 94,
          rubricNotes: JSON.stringify({
            mentionsInverseOperation: true,
            mentionsBothSides: true,
            correctFinalReasoning: true,
          }),
        },
      })
      .catch(() => null);
  }

  // Roadmap snapshot
  await prisma.roadmap.upsert({
    where: { userId: user.id },
    update: {
      nodes: JSON.stringify([
        { conceptId: conceptMap["algebra"], status: "mastered", masteryScore: 100 },
        { conceptId: conceptMap["equations"], status: "mastered", masteryScore: 100 },
        { conceptId: inverseOpsId, status: "mastered", masteryScore: 100 },
        { conceptId: signId, status: "active", masteryScore: 61 },
        { conceptId: conceptMap["distribution"], status: "active", masteryScore: 88 },
        { conceptId: conceptMap["factoring"], status: "locked", masteryScore: 0 },
        { conceptId: conceptMap["quadratics"], status: "locked", masteryScore: 0 },
      ]),
    },
    create: {
      userId: user.id,
      nodes: JSON.stringify([
        { conceptId: conceptMap["algebra"], status: "mastered", masteryScore: 100 },
        { conceptId: conceptMap["equations"], status: "mastered", masteryScore: 100 },
        { conceptId: inverseOpsId, status: "mastered", masteryScore: 100 },
        { conceptId: signId, status: "active", masteryScore: 61 },
        { conceptId: conceptMap["distribution"], status: "active", masteryScore: 88 },
        { conceptId: conceptMap["factoring"], status: "locked", masteryScore: 0 },
        { conceptId: conceptMap["quadratics"], status: "locked", masteryScore: 0 },
      ]),
    },
  });

  // Award a couple of achievements for the demo user
  for (const slug of ["first-gap", "teach-back"]) {
    const ach = await prisma.achievement.findUnique({ where: { slug } });
    if (ach) {
      await prisma.userAchievement
        .upsert({
          where: { userId_achievementId: { userId: user.id, achievementId: ach.id } },
          update: {},
          create: { userId: user.id, achievementId: ach.id },
        })
        .catch(() => null);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
