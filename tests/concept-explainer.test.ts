import { describe, it, expect } from "vitest";
import { detectAskIntent } from "@/lib/concepts/ask-intent";
import { matchConcept, type MatchableConcept } from "@/lib/concepts/match-concept";
import { buildConceptLesson } from "@/lib/teaching/build-concept-lesson";
import { buildConceptQuiz, misconceptionForAnswer } from "@/lib/quiz/build-concept-quiz";
import { selectConceptVisual } from "@/lib/ai/visuals/select-visual";
import { exampleFor, CANONICAL_EXAMPLES } from "@/lib/concepts/canonical-examples";
import { MISCONCEPTIONS } from "@/lib/diagnosis/misconceptions";

const CONCEPTS: MatchableConcept[] = [
  {
    id: "c-photo",
    slug: "photosynthesis",
    name: "Photosynthesis",
    subject: "Biology",
    description: "Plants convert light energy into chemical energy stored in glucose.",
    commonErrors: ["Describing photosynthesis as how a plant breathes"],
  },
  {
    id: "c-resp",
    slug: "respiration",
    name: "Respiration",
    subject: "Biology",
    description: "Cells release energy from glucose.",
    commonErrors: ["Treating respiration and breathing as the same thing"],
  },
  {
    id: "c-dist",
    slug: "distribution",
    name: "Distribution",
    subject: "Math",
    description: "A multiplier outside a bracket applies to every term inside it.",
    commonErrors: ["Distributing to the first term only"],
  },
  {
    id: "c-moles",
    slug: "moles-and-stoichiometry",
    name: "Moles and Stoichiometry",
    subject: "Chemistry",
    description: "The mole relates mass to a count of particles.",
    commonErrors: ["Using mass ratios where mole ratios are needed"],
  },
];

/**
 * The routing decision. Getting it wrong is recoverable — the student sees the
 * wrong topic and asks again. Getting the *direction* wrong is not: sending
 * real working to the explainer throws away the diagnosis, which is the one
 * thing this app is for.
 */
describe("detectAskIntent", () => {
  it("reads an explicit request as a question", () => {
    expect(detectAskIntent("explain photosynthesis")).toEqual({
      kind: "concept",
      topic: "photosynthesis",
    });
  });

  it("handles the phrasings students actually type", () => {
    for (const phrase of [
      "what is respiration",
      "What is respiration?",
      "how does respiration work",
      "teach me respiration",
      "why is respiration important",
    ]) {
      const intent = detectAskIntent(phrase);
      expect(intent.kind, phrase).toBe("concept");
      if (intent.kind === "concept") expect(intent.topic.toLowerCase()).toContain("respiration");
    }
  });

  it("treats a bare topic as a question", () => {
    expect(detectAskIntent("photosynthesis").kind).toBe("concept");
  });

  it("never sends a chain of working to the explainer", () => {
    const working = ["2x + 7 = 15", "2x = 15 + 7", "2x = 22", "x = 11"].join("\n");
    expect(detectAskIntent(working)).toEqual({ kind: "working" });
  });

  it("treats a single equation as working, not a question", () => {
    expect(detectAskIntent("2x + 7 = 15")).toEqual({ kind: "working" });
  });

  it("treats 'explain 2x + 7 = 15' as working — there is something to check", () => {
    expect(detectAskIntent("explain 2x + 7 = 15")).toEqual({ kind: "working" });
  });

  it("treats a chemical equation as working", () => {
    expect(detectAskIntent("2H2 + O2 -> 2H2O")).toEqual({ kind: "working" });
  });

  it("is not fooled by an empty request", () => {
    expect(detectAskIntent("explain")).toEqual({ kind: "working" });
    expect(detectAskIntent("   ")).toEqual({ kind: "working" });
  });
});

describe("matchConcept", () => {
  it("matches the obvious topic", () => {
    const { best } = matchConcept("photosynthesis", CONCEPTS);
    expect(best?.concept.slug).toBe("photosynthesis");
  });

  it("uses curated aliases rather than token overlap alone", () => {
    // "cellular respiration" must not be dragged toward "cell" or "photosynthesis".
    expect(matchConcept("cellular respiration", CONCEPTS).best?.concept.slug).toBe("respiration");
    // "expanding brackets" names no concept directly.
    expect(matchConcept("expanding brackets", CONCEPTS).best?.concept.slug).toBe("distribution");
    // "mole" must not be pulled to "molecule"-ish text elsewhere.
    expect(matchConcept("moles", CONCEPTS).best?.concept.slug).toBe("moles-and-stoichiometry");
  });

  it("returns nothing rather than guessing at an unrelated topic", () => {
    const { best, alternatives } = matchConcept("the french revolution", CONCEPTS);
    expect(best).toBeNull();
    expect(Array.isArray(alternatives)).toBe(true);
  });

  it("treats the chosen subject as a hint, not a filter", () => {
    // A student browsing Biology who asks about moles still gets moles.
    const { best } = matchConcept("moles", CONCEPTS, { subjectHint: "Biology" });
    expect(best?.concept.slug).toBe("moles-and-stoichiometry");
  });
});

describe("buildConceptLesson", () => {
  const source = {
    conceptName: "Photosynthesis",
    subject: "Biology",
    description: "Plants convert light energy into chemical energy stored in glucose.",
    commonErrors: ["Describing photosynthesis as how a plant breathes"],
    chunks: [
      { id: "k1", kind: "explanation", title: "How it works", content: "Light is absorbed by chlorophyll." },
      { id: "k2", kind: "misconception", title: "Common error", content: "Oxygen is a by-product." },
    ],
    misconceptions: MISCONCEPTIONS.filter((m) => m.conceptSlug === "photosynthesis"),
  };

  it("teaches from curated material and cites what it used", () => {
    const lesson = buildConceptLesson(source);
    expect(lesson.lines.length).toBeGreaterThanOrEqual(4);
    expect(lesson.citedChunkIds).toContain("k1");
    expect(lesson.citedChunkIds).toContain("k2");
  });

  it("names where the concept usually breaks and ends with a check", () => {
    const lesson = buildConceptLesson(source);
    expect(lesson.lines.some((l) => l.role === "why")).toBe(true);
    expect(lesson.lines[lesson.lines.length - 1]?.role).toBe("avoid");
  });

  it("still produces a lesson when the corpus has nothing for the concept", () => {
    const lesson = buildConceptLesson({ ...source, chunks: [], misconceptions: [] });
    expect(lesson.lines.length).toBeGreaterThan(0);
    expect(lesson.citedChunkIds).toHaveLength(0);
  });
});

/**
 * The quiz is the claim that the explanation landed, so its distractors have to
 * be real: a wrong answer must name a rule the student might actually hold.
 */
describe("buildConceptQuiz", () => {
  const source = {
    conceptSlug: "photosynthesis",
    conceptName: "Photosynthesis",
    subject: "Biology",
    description: "Plants convert light energy into chemical energy stored in glucose.",
    commonErrors: ["Describing photosynthesis as how a plant breathes"],
  };

  it("builds questions whose correct answer is among the options", () => {
    const quiz = buildConceptQuiz(source, "seed");
    expect(quiz.length).toBeGreaterThan(0);
    for (const q of quiz) {
      expect(q.options).toContain(q.correctAnswer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("is stable for the same student and concept", () => {
    expect(buildConceptQuiz(source, "seed")).toEqual(buildConceptQuiz(source, "seed"));
  });

  it("does not always put the answer in the same position", () => {
    const positions = new Set(
      ["a", "b", "c", "d", "e", "f"].map((seed) => {
        const quiz = buildConceptQuiz(source, seed);
        return quiz[0]?.options.indexOf(quiz[0].correctAnswer);
      })
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it("builds a quiz for every seeded concept slug we ship an example for", () => {
    for (const slug of Object.keys(CANONICAL_EXAMPLES)) {
      const quiz = buildConceptQuiz({ ...source, conceptSlug: slug, conceptName: slug }, "seed");
      expect(quiz.length, slug).toBeGreaterThan(0);
    }
  });
});

describe("misconceptionForAnswer", () => {
  it("recognises a distractor as the catalogue entry it came from", () => {
    const target = MISCONCEPTIONS.find((m) => m.code === "B-PHOTOSYNTHESIS-AS-BREATHING")!;
    expect(misconceptionForAnswer(target.studentRule)).toBe("B-PHOTOSYNTHESIS-AS-BREATHING");
  });

  it("returns null for text that is not a catalogued rule", () => {
    expect(misconceptionForAnswer("Plants convert light energy into glucose.")).toBeNull();
  });
});

/**
 * The diagram has to come from real numbers even when the student has written
 * nothing — that is the whole reason the examples are curated rather than
 * generated.
 */
describe("concept visuals from curated examples", () => {
  it("draws a diagram for every concept that ships an example", () => {
    for (const [slug, example] of Object.entries(CANONICAL_EXAMPLES)) {
      const visual = selectConceptVisual({
        conceptSlug: example.visualSlug ?? slug,
        originalExpression: example.expression,
        correctedExpression: example.corrected ?? null,
      });
      expect(visual.kind, `${slug} should render a visual`).not.toBe("none");
    }
  });

  it("draws the biology process flows with no expression at all", () => {
    for (const slug of ["photosynthesis", "respiration"]) {
      expect(selectConceptVisual({ conceptSlug: slug }).kind).toBe("process-flow");
    }
  });

  it("has no example for a concept the visual selector cannot draw", () => {
    // cell-structure has no deterministic diagram, so it must not claim one.
    expect(exampleFor("cell-structure")).toBeNull();
    expect(selectConceptVisual({ conceptSlug: "cell-structure" }).kind).toBe("none");
  });
});
