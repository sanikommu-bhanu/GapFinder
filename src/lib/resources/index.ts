import { prisma } from "@/lib/db/prisma";
import { searchCrossref, searchArxiv } from "./providers/research";
import { searchVideos } from "./providers/video";
import type { ResourceBundle, ResourceQuery, LearningResource } from "./types";

export type { LearningResource, ResourceBundle, ResourceQuery } from "./types";

/**
 * Gathers resources for a diagnosed gap.
 *
 * Two rules shape this. Providers run *concurrently*, because a student should
 * never wait on Crossref to see their diagnosis — the resource panel loads
 * separately and fills in when it's ready. And results are cached per
 * concept-plus-misconception, because the same gap produces the same query
 * every time and there's no reason to hit an external API twice for it.
 *
 * A provider that fails, times out, or isn't configured is reported in
 * `unavailable` rather than silently producing nothing.
 */

/** Resources for a concept change on the scale of months, not minutes. */
const CACHE_TTL_HOURS = 24 * 14;

function cacheKey(query: ResourceQuery): string {
  return `resources:${query.subject}:${query.conceptSlug}:${query.misconceptionName ?? "none"}`;
}

export async function getResources(query: ResourceQuery): Promise<ResourceBundle> {
  const key = cacheKey(query);

  const cached = await prisma.aiCallCache.findUnique({ where: { cacheKey: key } });
  if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
    try {
      return JSON.parse(cached.responseJson) as ResourceBundle;
    } catch {
      // Fall through and refetch rather than serving a corrupt row.
    }
  }

  // Concurrent: the slowest provider sets the wait, not the sum of all three.
  const [videos, crossref, arxiv] = await Promise.allSettled([
    searchVideos(query, 2),
    searchCrossref(query, 2),
    searchArxiv(query, 1),
  ]);

  const unavailable: ResourceBundle["unavailable"] = [];

  const videoResults = settled(videos, "YouTube", unavailable);
  const paperResults = [
    ...settled(crossref, "Crossref", unavailable),
    ...settled(arxiv, "arXiv", unavailable),
  ];

  if (paperResults.length === 0 && !unavailable.some((u) => u.provider === "Crossref")) {
    // Asked and answered, with nothing relevant. Saying so is better than an
    // empty panel that looks broken.
    unavailable.push({ provider: "Research", reason: "No closely matching papers were found for this concept." });
  }

  const bundle: ResourceBundle = { videos: videoResults, papers: paperResults, unavailable };

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

function settled(
  result: PromiseSettledResult<LearningResource[]>,
  provider: string,
  unavailable: ResourceBundle["unavailable"]
): LearningResource[] {
  if (result.status === "fulfilled") return result.value;
  unavailable.push({ provider, reason: "Couldn't be reached just now." });
  return [];
}
