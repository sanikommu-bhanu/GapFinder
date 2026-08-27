import { prisma } from "@/lib/db/prisma";
import { hasYouTubeKey } from "@/lib/env";
import {
  searchCrossref,
  searchArxiv,
  conceptTerms,
  hasUsableAnchors,
  isRelevant,
} from "./providers/research";
import { searchOpenAlex } from "./providers/openalex";
import { searchGitHub, supportsSubject as githubSupports } from "./providers/github";
import { searchVideos } from "./providers/video";
import type { ResourceProvider } from "./registry";
import type { ResourceBundle, ResourceQuery, LearningResource } from "./types";

export type { LearningResource, ResourceBundle, ResourceQuery } from "./types";
export type { ResourceProvider } from "./registry";

/**
 * Gathers resources for a diagnosed gap.
 *
 * Three rules shape this. Providers run *concurrently*, because a student
 * should never wait on Crossref to see their diagnosis — the resource panel
 * loads separately and fills in when it's ready. Results are cached per
 * concept-plus-misconception, because the same gap produces the same query
 * every time and there is no reason to hit an external API twice for it. And
 * the aggregator knows nothing about any individual provider: it maps over the
 * registry, so a new source is one file plus one entry.
 *
 * A provider that fails, times out, or isn't configured is reported in
 * `unavailable` rather than silently producing nothing.
 */

/** Resources for a concept change on the scale of months, not minutes. */
const CACHE_TTL_HOURS = 24 * 14;

/**
 * The registry.
 *
 * Order matters only for display grouping; every provider below runs at the
 * same time. Budgets are deliberately small — the brief for this panel is
 * "best for you", not "everything we could find", and a student who is shown
 * fifty links reads none of them.
 */
const PROVIDERS: (ResourceProvider & { budget: number })[] = [
  {
    id: "youtube",
    label: "YouTube",
    kind: "video",
    budget: 2,
    // The video provider degrades to an honest search handoff without a key,
    // so it is always "configured" — it simply answers differently.
    isConfigured: () => true,
    supports: () => true,
    search: (q, n) => searchVideos(q, n),
  },
  {
    id: "openalex",
    label: "OpenAlex",
    kind: "paper",
    budget: 2,
    isConfigured: () => true, // keyless
    supports: (q) => hasUsableAnchors(q),
    search: (q, n) => searchOpenAlex(q, n, anchorTerms(q)),
  },
  {
    id: "crossref",
    label: "Crossref",
    kind: "paper",
    budget: 2,
    isConfigured: () => true, // keyless
    supports: (q) => hasUsableAnchors(q),
    search: (q, n) => searchCrossref(q, n),
  },
  {
    id: "arxiv",
    label: "arXiv",
    kind: "paper",
    budget: 1,
    isConfigured: () => true, // keyless
    supports: (q) => hasUsableAnchors(q),
    search: (q, n) => searchArxiv(q, n),
  },
  {
    id: "github",
    label: "GitHub",
    kind: "code",
    budget: 2,
    isConfigured: () => true, // token optional, only raises the rate limit
    supports: (q) => githubSupports(q),
    search: (q, n) => searchGitHub(q, n),
  },
];

/** The distinctive terms for a concept, shared with the relevance gate. */
function anchorTerms(query: ResourceQuery): string[] {
  return conceptTerms(query);
}

function cacheKey(query: ResourceQuery): string {
  // Versioned: adding OpenAlex and GitHub changed what a bundle contains, and
  // a stale two-week cache entry would keep serving the old shape.
  return `resources:v2:${query.subject}:${query.conceptSlug}:${query.misconceptionName ?? "none"}`;
}

export async function getResources(query: ResourceQuery): Promise<ResourceBundle> {
  const key = cacheKey(query);

  const cached = await prisma.aiCallCache.findUnique({ where: { cacheKey: key } }).catch(() => null);
  if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
    try {
      return JSON.parse(cached.responseJson) as ResourceBundle;
    } catch {
      // Fall through and refetch rather than serving a corrupt row.
    }
  }

  const unavailable: ResourceBundle["unavailable"] = [];

  // A provider that declines the subject is not a failure and is not reported:
  // GitHub having nothing to say about photosynthesis is correct behaviour.
  const active = PROVIDERS.filter((p) => p.isConfigured() && p.supports(query));

  // Concurrent: the slowest provider sets the wait, not the sum of all five.
  const settled = await Promise.allSettled(
    active.map((p) => p.search(query, p.budget))
  );

  const collected: { provider: ResourceProvider; results: LearningResource[] }[] = [];

  settled.forEach((outcome, i) => {
    const provider = active[i]!;
    if (outcome.status === "fulfilled") {
      collected.push({ provider, results: outcome.value });
    } else {
      unavailable.push({ provider: provider.label, reason: "Couldn't be reached just now." });
    }
  });

  const videos = collected.filter((c) => c.provider.kind === "video").flatMap((c) => c.results);
  const code = collected.filter((c) => c.provider.kind === "code").flatMap((c) => c.results);

  // Papers arrive from three sources that overlap heavily — the same study is
  // routinely in OpenAlex and Crossref both. Dedupe, re-gate for relevance,
  // then rank.
  const papers = rankPapers(
    dedupe(collected.filter((c) => c.provider.kind === "paper").flatMap((c) => c.results)),
    query
  );

  const paperProvidersAsked = collected.some((c) => c.provider.kind === "paper");
  if (papers.length === 0 && paperProvidersAsked) {
    // Asked and answered, with nothing relevant. Saying so is better than an
    // empty panel that looks broken.
    unavailable.push({
      provider: "Research",
      reason: "No closely matching papers were found for this concept.",
    });
  }

  const bundle: ResourceBundle = { videos, papers, code, unavailable };

  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 3600_000);
  await prisma.aiCallCache
    .upsert({
      where: { cacheKey: key },
      create: { cacheKey: key, stage: "resources", responseJson: JSON.stringify(bundle), expiresAt },
      update: { responseJson: JSON.stringify(bundle), expiresAt },
    })
    .catch(() => {
      // Caching is an optimisation; failing to cache must not fail the request.
    });

  return bundle;
}

/**
 * The same paper reached through OpenAlex and Crossref is one paper. DOIs are
 * the reliable identity; where one is missing, a normalised title is close
 * enough to catch the duplicate without merging two genuinely distinct works.
 */
function dedupe(papers: LearningResource[]): LearningResource[] {
  const seen = new Set<string>();
  const out: LearningResource[] = [];
  for (const paper of papers) {
    const doi = paper.url.toLowerCase().match(/10\.\d{4,}\/\S+/)?.[0];
    const identity = doi ?? paper.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push(paper);
  }
  return out;
}

/**
 * "Best for you" ordering.
 *
 * A paper the student can open in full beats one behind a paywall, and among
 * equals the newer education research is the more useful. The relevance gate
 * runs once more here because OpenAlex ranks across its whole corpus and can
 * surface something that merely shares a common word.
 */
function rankPapers(papers: LearningResource[], query: ResourceQuery): LearningResource[] {
  return papers
    .filter((p) => isRelevant(p, query))
    .sort((a, b) => {
      const openAccess = (r: LearningResource) => (r.url.includes("doi.org") ? 0 : 1);
      const byAccess = openAccess(b) - openAccess(a);
      if (byAccess !== 0) return byAccess;
      return (b.year ?? 0) - (a.year ?? 0);
    })
    .slice(0, 4);
}
