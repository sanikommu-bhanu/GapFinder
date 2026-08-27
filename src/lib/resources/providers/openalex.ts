import { env } from "@/lib/env";
import type { LearningResource, ResourceQuery } from "../types";

/**
 * OpenAlex — the third research source, and the one that earns its place.
 *
 * Crossref knows what was published; OpenAlex knows how it was received and
 * whether a student can actually read it. Two fields matter here that the
 * others don't carry: `open_access.oa_url`, which is a legally free full text
 * rather than a paywalled DOI landing page, and `cited_by_count`, which lets a
 * foundational paper outrank a recent obscure one.
 *
 * It is free, keyless, and rate-limited at 100k requests/day. Sending a mailto
 * joins the "polite pool", which OpenAlex asks for and rewards with better
 * throughput — it is a courtesy identifier, not a credential, which is why it
 * is safe to have in config at all.
 *
 * Abstracts arrive as an inverted index (word → positions) rather than text,
 * so they are reconstructed below. As everywhere in this layer, no field shown
 * to a student is generated: a fabricated citation is the one error a student
 * would repeat in their own coursework.
 */

const ENDPOINT = "https://api.openalex.org/works";
const TIMEOUT_MS = 6000;

interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]> | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null;
  primary_location?: { source?: { display_name?: string | null } | null } | null;
  authorships?: { author?: { display_name?: string | null } | null }[] | null;
  type?: string | null;
}

/**
 * OpenAlex stores abstracts as {word: [positions]} for licensing reasons.
 * Rebuilding it is lossless enough for a summary and keeps us from showing a
 * student a bag of words.
 */
function rebuildAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) slots[pos] = word;
  }
  const text = slots.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text.slice(0, 320) : null;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch {
    // A slow provider must never hold up a diagnosis.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchOpenAlex(
  query: ResourceQuery,
  limit: number,
  terms: string[]
): Promise<LearningResource[]> {
  if (terms.length === 0) return [];

  const params = new URLSearchParams({
    search: `${terms.join(" ")} student misconception`,
    // Journal articles only; reviews and editorials teach a student less.
    filter: "type:article,has_abstract:true",
    // Citations break ties toward work the field actually built on.
    sort: "relevance_score:desc",
    per_page: String(Math.max(limit * 3, 6)),
    select:
      "id,doi,title,display_name,publication_year,cited_by_count,abstract_inverted_index,open_access,primary_location,authorships,type",
  });
  if (env.OPENALEX_MAILTO) params.set("mailto", env.OPENALEX_MAILTO);

  const res = await fetchWithTimeout(`${ENDPOINT}?${params}`);
  // A null response is a timeout, a non-ok is the provider refusing. Both mean
  // "ask again later", which the aggregator reports rather than hides.
  if (!res) throw new Error("OpenAlex timed out");
  if (!res.ok) throw new Error(`OpenAlex returned ${res.status}`);

  let works: OpenAlexWork[] = [];
  try {
    const json = (await res.json()) as { results?: OpenAlexWork[] };
    works = json.results ?? [];
  } catch {
    throw new Error("OpenAlex returned malformed JSON");
  }

  return works
    .map((w) => toResource(w, query))
    .filter((r): r is LearningResource => r !== null)
    .slice(0, limit);
}

function toResource(work: OpenAlexWork, query: ResourceQuery): LearningResource | null {
  const title = (work.title ?? work.display_name ?? "").trim();
  if (!title) return null;

  // Prefer a free full text the student can actually open; fall back to the
  // DOI. With neither there is nothing to link to, so nothing is shown.
  const oaUrl = work.open_access?.is_oa ? work.open_access.oa_url ?? null : null;
  const doiUrl = work.doi ? (work.doi.startsWith("http") ? work.doi : `https://doi.org/${work.doi}`) : null;
  const url = oaUrl ?? doiUrl;
  if (!url) return null;

  const authors = (work.authorships ?? [])
    .map((a) => a.author?.display_name?.trim())
    .filter((n): n is string => Boolean(n))
    .slice(0, 4);

  return {
    id: `openalex:${work.id ?? url}`,
    kind: "paper",
    provenance: "verified",
    title,
    url,
    source: work.primary_location?.source?.display_name?.trim() ?? "OpenAlex",
    year: typeof work.publication_year === "number" ? work.publication_year : null,
    authors,
    summary: rebuildAbstract(work.abstract_inverted_index),
    why: oaUrl
      ? `Free full text on ${(query.misconceptionName ?? query.conceptName).toLowerCase()} — the misconception behind your gap.`
      : `Research on ${(query.misconceptionName ?? query.conceptName).toLowerCase()} — the misconception behind your gap.`,
  };
}
