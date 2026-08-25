/**
 * Telling a question apart from a piece of working.
 *
 * The capture screen accepts both, and getting this wrong is expensive in both
 * directions: running the step-verifier over "explain photosynthesis" finds a
 * divergence in a sentence, and sending real working to the explainer throws
 * away the one thing GapFinder is for.
 *
 * So the test is structural rather than semantic. Working has the shape of
 * working — multiple lines, relations, operators, a chain to compare. A
 * question has the shape of a question. Where the shape is ambiguous, this
 * returns `working`, because the diagnosis path degrades more gracefully than
 * the explainer does.
 */

export type AskIntent =
  | { kind: "working" }
  | { kind: "concept"; topic: string };

/** Openers that make the intent explicit whatever follows them. */
const ASK_OPENERS = [
  "explain",
  "what is",
  "what are",
  "what does",
  "whats",
  "what's",
  "teach me",
  "tell me about",
  "how does",
  "how do",
  "how is",
  "why does",
  "why do",
  "why is",
  "define",
  "describe",
  "help me understand",
  "i don't understand",
  "i dont understand",
  "i don't get",
  "i dont get",
  "show me",
];

/** Trailing words to drop so "explain photosynthesis to me please" still matches. */
const TRAILING_NOISE = /\b(to me|for me|please|pls|simply|in simple terms|step by step|briefly)\b/gi;

export function detectAskIntent(raw: string): AskIntent {
  const text = raw.trim();
  if (!text) return { kind: "working" };

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // A chain of lines is working being shown, not a question being asked.
  if (lines.length > 2) return { kind: "working" };

  const joined = lines.join(" ");
  const lower = joined.toLowerCase();

  const opener = ASK_OPENERS.find((o) => lower.startsWith(o));
  if (opener) {
    const topic = cleanTopic(joined.slice(opener.length));
    // "explain" on its own isn't a topic; "explain 2x + 7 = 15" is working
    // someone wants walked through, which the diagnosis path already does.
    if (topic && !looksComputational(topic)) return { kind: "concept", topic };
    return { kind: "working" };
  }

  // No opener: a single short line with no maths in it and a question mark, or
  // a bare topic phrase, is still a question.
  if (lines.length === 1 && !looksComputational(joined)) {
    const words = joined.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 8) {
      return { kind: "concept", topic: cleanTopic(joined) };
    }
  }

  return { kind: "working" };
}

/** Does this read as something to be solved rather than something to be asked? */
function looksComputational(text: string): boolean {
  if (/[=<>≤≥]/.test(text)) return true;
  if (/→|->|⇌/.test(text)) return true;
  // An operator sitting between two numbers or a number and a variable.
  if (/\d\s*[+\-*/^]\s*[\d(a-zA-Z]/.test(text)) return true;
  // A bracketed algebraic term, e.g. "2(3x-5)".
  if (/\d\s*\(/.test(text)) return true;
  return false;
}

function cleanTopic(text: string): string {
  return text
    .replace(TRAILING_NOISE, " ")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/^\s*(me|about|the|a|an|of|on|how|why|what|is|are|does|do)\b/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}
