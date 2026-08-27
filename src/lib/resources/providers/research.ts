import type { LearningResource, ResourceQuery } from "../types";

/**
 * Real research, from Crossref and arXiv.
 *
 * Both are free, keyless, and authoritative: Crossref is the DOI registry every
 * major publisher writes to, and arXiv is the canonical preprint server. Every
 * field shown to a student — title, authors, year, DOI — comes back from those
 * APIs. None of it is generated, which is the entire point: a fabricated
 * citation is the one failure a student would actually repeat in their own work.
 *
 * A result with no resolvable DOI or arXiv id is dropped rather than shown.
 */

const CROSSREF_ENDPOINT = "https://api.crossref.org/works";
const ARXIV_ENDPOINT = "https://export.arxiv.org/api/query";
const TIMEOUT_MS = 6000;

/** Crossref asks callers to identify themselves; it raises the rate limit. */
const USER_AGENT = "GapFinder/1.0 (educational diagnostic tool; mailto:noreply@gapfinder.app)";

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    // A slow or unreachable provider must never hold up a diagnosis.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search terms per concept.
 *
 * The misconception's display name is prose ("Losing the sign when distributing
 * a negative") and searching it verbatim matches on filler words — it returned
 * a paper about losing weight. These are the terms the literature actually
 * uses, so the query hits education research rather than whatever shares an
 * adjective.
 */
const CONCEPT_TERMS: Record<string, string[]> = {
  "sign-handling": ["signed numbers", "negative numbers", "algebra errors"],
  distribution: ["distributive property", "algebra errors"],
  "inverse-operations": ["equation solving", "inverse operations", "algebra"],
  equations: ["equation solving", "equals sign", "algebra"],
  factoring: ["factoring", "quadratic", "algebra"],
  quadratics: ["quadratic equations", "algebra"],
  fractions: ["fraction", "rational number"],
  "linear-graphing": ["linear function", "graphing", "slope"],
  "units-and-dimensions": ["units", "dimensional analysis", "physics education"],
  "formula-substitution": ["problem solving", "physics education"],
  kinematics: ["kinematics", "physics education"],
  "energy-and-work": ["energy", "physics education"],
  "newtons-laws": ["force", "newtonian mechanics", "physics education"],
  "chemical-equations": ["chemical equations", "chemistry education"],
  "balancing-equations": ["balancing chemical equations", "chemistry education"],
  "moles-and-stoichiometry": ["stoichiometry", "mole concept"],
  "atomic-structure": ["atomic structure", "chemistry education"],
  "cell-structure": ["cell biology", "biology education"],
  photosynthesis: ["photosynthesis", "biology education"],
  respiration: ["cellular respiration", "biology education"],
  "genetics-inheritance": ["genetics", "inheritance", "biology education"],
};

export function conceptTerms(query: ResourceQuery): string[] {
  return CONCEPT_TERMS[query.conceptSlug] ?? [query.conceptName.toLowerCase()];
}

/** A concept with no distinctive term can't be matched, so nothing is shown. */
export function hasUsableAnchors(query: ResourceQuery): boolean {
  return conceptTerms(query)
    .flatMap((t) => t.split(" "))
    .some((w) => w.length > 4 && !GENERIC_ANCHORS.has(w));
}

function buildQuery(query: ResourceQuery): string {
  return `${conceptTerms(query).join(" ")} students misconception`;
}

/**
 * Keeps only results that are actually about the concept.
 *
 * Crossref ranks by text relevance across its whole corpus, which for a short
 * query can surface something that merely shares a common word. Requiring a
 * distinctive term in the title or abstract is a cheap, deterministic gate —
 * and returning nothing is the correct outcome when nothing matches, because a
 * confidently irrelevant citation is worse than an empty panel.
 */
/** Words that mark a paper as being about *teaching*, not the pure subject. */
const EDUCATION_SIGNALS = [
  "student",
  "misconception",
  "teaching",
  "learner",
  "education",
  "classroom",
  "pedagog",
  "curriculum",
  "instruction",
];

/**
 * Words that appear in every education paper and therefore identify none.
 * "physics education" must anchor on "physics" — anchoring on "education"
 * matched a chemistry paper to both a physics and a biology concept.
 */
const GENERIC_ANCHORS = new Set([
  "education",
  "errors",
  "error",
  "concept",
  "concepts",
  "problem",
  "problems",
  "solving",
  "student",
  "students",
  "learning",
  "number",
  "numbers",
]);

function relevanceScore(resource: LearningResource, query: ResourceQuery): number {
  const haystack = `${resource.title} ${resource.summary ?? ""}`.toLowerCase();
  // The distinctive noun of each term — "distributive" from "distributive
  // property", "kinematics" from "kinematics".
  const anchors = conceptTerms(query)
    .flatMap((t) => t.split(" "))
    .filter((w) => w.length > 4 && !GENERIC_ANCHORS.has(w));

  const onConcept = anchors.some((anchor) => haystack.includes(anchor));
  if (!onConcept) return 0;

  // A paper on distributive lattices mentions "distributive" and teaches a
  // student nothing. Requiring an education signal separates a maths paper
  // about the topic from a paper about how the topic is misunderstood.
  const aboutTeaching = EDUCATION_SIGNALS.some((signal) => haystack.includes(signal));
  return aboutTeaching ? 2 : 1;
}

export function isRelevant(resource: LearningResource, query: ResourceQuery): boolean {
  return relevanceScore(resource, query) >= 2;
}

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: { given?: string; family?: string }[];
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  abstract?: string;
  type?: string;
}

export async function searchCrossref(query: ResourceQuery, limit = 2): Promise<LearningResource[]> {
  if (!hasUsableAnchors(query)) return [];

  const params = new URLSearchParams({
    query: buildQuery(query),
    rows: String(limit * 3),
    select: "DOI,title,author,issued,container-title,abstract,type",
    // Journal articles only — datasets and corrections aren't teaching material.
    filter: "type:journal-article,has-abstract:true",
    sort: "relevance",
  });

  const res = await fetchWithTimeout(`${CROSSREF_ENDPOINT}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res?.ok) return [];

  let items: CrossrefItem[] = [];
  try {
    const json = (await res.json()) as { message?: { items?: CrossrefItem[] } };
    items = json.message?.items ?? [];
  } catch {
    return [];
  }

  return items
    .map((item) => toResource(item, query))
    .filter((r): r is LearningResource => r !== null)
    .filter((r) => isRelevant(r, query))
    // Newer education research first among equally relevant results.
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, limit);
}

function toResource(item: CrossrefItem, query: ResourceQuery): LearningResource | null {
  const doi = item.DOI?.trim();
  const title = item.title?.[0]?.trim();
  // Without a DOI there is nothing to resolve, so there is nothing to show.
  if (!doi || !title) return null;

  const authors = (item.author ?? [])
    .map((a) => [a.given, a.family].filter(Boolean).join(" ").trim())
    .filter(Boolean)
    .slice(0, 4);

  const year = item.issued?.["date-parts"]?.[0]?.[0] ?? null;

  return {
    id: `doi:${doi}`,
    kind: "paper",
    provenance: "verified",
    title: decodeEntities(title),
    url: `https://doi.org/${doi}`,
    source: item["container-title"]?.[0] ? decodeEntities(item["container-title"][0]!) : null,
    year: typeof year === "number" ? year : null,
    authors,
    summary: item.abstract ? stripMarkup(item.abstract).slice(0, 320) : null,
    why: `Research on ${(query.misconceptionName ?? query.conceptName).toLowerCase()} — the misconception behind your gap.`,
  };
}

/** arXiv returns Atom XML; parsed narrowly rather than with a full XML dep. */
export async function searchArxiv(query: ResourceQuery, limit = 1): Promise<LearningResource[]> {
  const params = new URLSearchParams({
    search_query: `all:"${conceptTerms(query)[0]}" AND all:education`,
    start: "0",
    max_results: String(limit * 2),
    sortBy: "relevance",
  });

  const res = await fetchWithTimeout(`${ARXIV_ENDPOINT}?${params}`);
  if (!res?.ok) return [];

  let xml = "";
  try {
    xml = await res.text();
  } catch {
    return [];
  }

  const entries = xml.split("<entry>").slice(1);
  const results: LearningResource[] = [];

  for (const entry of entries) {
    const id = pick(entry, "id");
    const title = pick(entry, "title");
    if (!id || !title || !id.includes("arxiv.org/abs/")) continue;

    const authors = [...entry.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1]!.trim()).slice(0, 4);
    const published = pick(entry, "published");
    const year = published ? Number(published.slice(0, 4)) : null;

    const candidate: LearningResource = {
      id: `arxiv:${id}`,
      kind: "paper",
      provenance: "verified",
      title: collapse(title),
      url: id.trim(),
      source: "arXiv",
      year: Number.isFinite(year) ? year : null,
      authors,
      summary: pick(entry, "summary") ? collapse(pick(entry, "summary")!).slice(0, 320) : null,
      why: `Preprint touching ${query.conceptName.toLowerCase()}.`,
    };
    if (!isRelevant(candidate, query)) continue;
    results.push(candidate);
    if (results.length >= limit) break;
  }

  return results;
}

function pick(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1]! : null;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripMarkup(text: string): string {
  return collapse(text.replace(/<[^>]+>/g, " "));
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
