import { env } from "@/lib/env";
import type { LearningResource, ResourceQuery } from "../types";

/**
 * GitHub — "See It In The Real World".
 *
 * Scope discipline is the whole design here. A repository makes a graph
 * traversal or a floating-point rounding gap concrete in a way no diagram can,
 * and it tells a student with a photosynthesis gap absolutely nothing. So this
 * provider declines every subject except Computer Science and Engineering
 * rather than returning something weak for the rest.
 *
 * This is discovery and nothing more. GapFinder does not clone, execute,
 * analyse or vouch for any repository it links to — the claim made to the
 * student is "this concept appears in real code here", which is exactly what
 * the metadata supports and no more.
 *
 * Unauthenticated search is limited to 10 requests/minute, which a classroom
 * would exhaust in seconds. Results are cached by the aggregator for two weeks,
 * and a token (which only raises the limit to 30/min) is optional.
 */

const ENDPOINT = "https://api.github.com/search/repositories";
const TIMEOUT_MS = 6000;

/** Only subjects where reading source code is genuinely the better explanation. */
const SUPPORTED_SUBJECTS = new Set(["computer science", "engineering"]);

export function supportsSubject(query: ResourceQuery): boolean {
  return SUPPORTED_SUBJECTS.has(query.subject.trim().toLowerCase());
}

interface GitHubRepo {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  language?: string | null;
  owner?: { login?: string } | null;
  archived?: boolean;
  pushed_at?: string | null;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  // Sent only when configured; the search endpoint works without it.
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchGitHub(query: ResourceQuery, limit: number): Promise<LearningResource[]> {
  if (!supportsSubject(query)) return [];

  // The concept name, not the misconception prose. "Losing the sign when
  // distributing" is not a phrase any repository description contains.
  const term = query.conceptName.toLowerCase();
  const params = new URLSearchParams({
    q: `${term} in:name,description,topics stars:>100`,
    sort: "stars",
    order: "desc",
    per_page: String(Math.max(limit * 3, 6)),
  });

  const res = await fetchWithTimeout(`${ENDPOINT}?${params}`);
  if (!res) throw new Error("GitHub timed out");
  // 403 here is the rate limit, not a permissions problem. Either way the
  // honest report is "couldn't be reached just now".
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);

  let repos: GitHubRepo[] = [];
  try {
    const json = (await res.json()) as { items?: GitHubRepo[] };
    repos = json.items ?? [];
  } catch {
    throw new Error("GitHub returned malformed JSON");
  }

  return repos
    .filter((r) => !r.archived && r.full_name && r.html_url && r.description)
    .map((repo) => toResource(repo, query))
    .filter((r): r is LearningResource => r !== null)
    .slice(0, limit);
}

function toResource(repo: GitHubRepo, query: ResourceQuery): LearningResource | null {
  if (!repo.full_name || !repo.html_url) return null;

  const stars = repo.stargazers_count ?? 0;
  const starLabel =
    stars >= 1000 ? `${(stars / 1000).toFixed(1)}k stars` : `${stars} stars`;

  return {
    id: `github:${repo.full_name}`,
    kind: "interactive",
    provenance: "verified",
    title: repo.full_name,
    url: repo.html_url,
    source: repo.language ? `${repo.language} · ${starLabel}` : starLabel,
    year: repo.pushed_at ? Number(repo.pushed_at.slice(0, 4)) : null,
    authors: repo.owner?.login ? [repo.owner.login] : [],
    summary: repo.description ? repo.description.slice(0, 320) : null,
    why: `Here's where ${query.conceptName.toLowerCase()} appears in a real project.`,
  };
}
