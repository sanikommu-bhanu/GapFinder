import type { LearningResource, ResourceQuery } from "../types";

/**
 * Video recommendations.
 *
 * With a YouTube Data API key this returns real videos with real titles,
 * channels and ids, every one of them checked as embeddable and public before
 * it is shown.
 *
 * Without a key it returns a single *search handoff* — a precisely built query
 * the student can run themselves. That is a deliberate choice. The alternative
 * is asking a model for video URLs, which produces confident, plausible, dead
 * links, and a student who clicks three broken recommendations stops trusting
 * everything else the product says. A search that lands on the right results
 * page is honest; an invented video is not.
 *
 * Both paths are the same shape, so adding a key later changes nothing except
 * the quality of the answer.
 */

const YOUTUBE_SEARCH = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";
const TIMEOUT_MS = 6000;

function hasKey(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.length > 10);
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The search phrase is built from the misconception, not the concept name.
 * "Distribution" returns statistics videos; "distributing a negative across
 * brackets" returns the lesson this student actually needs.
 */
export function buildSearchPhrase(query: ResourceQuery): string {
  const focus = query.misconceptionName ?? query.conceptName;
  return `${focus} ${query.subject} explained`;
}

export async function searchVideos(query: ResourceQuery, limit = 2): Promise<LearningResource[]> {
  const phrase = buildSearchPhrase(query);

  if (!hasKey()) {
    return [
      {
        id: `search:${query.conceptSlug}`,
        kind: "video",
        provenance: "search",
        title: phrase,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(phrase)}`,
        source: "YouTube search",
        year: null,
        authors: [],
        summary: null,
        why: `Built from your diagnosed misconception rather than the topic name, so the results are about the specific thing that went wrong.`,
      },
    ];
  }

  const searchParams = new URLSearchParams({
    part: "snippet",
    q: phrase,
    type: "video",
    maxResults: String(limit * 3),
    // Lessons, not clips or livestreams.
    videoDuration: "medium",
    videoEmbeddable: "true",
    safeSearch: "strict",
    relevanceLanguage: "en",
    key: process.env.YOUTUBE_API_KEY!,
  });

  const res = await fetchWithTimeout(`${YOUTUBE_SEARCH}?${searchParams}`);
  if (!res?.ok) return [];

  let ids: string[] = [];
  let snippets = new Map<string, { title: string; channelTitle: string; description: string; publishedAt: string }>();
  try {
    const json = (await res.json()) as {
      items?: { id?: { videoId?: string }; snippet?: Record<string, string> }[];
    };
    for (const item of json.items ?? []) {
      const id = item.id?.videoId;
      if (!id || !item.snippet) continue;
      ids.push(id);
      snippets.set(id, {
        title: item.snippet.title ?? "",
        channelTitle: item.snippet.channelTitle ?? "",
        description: item.snippet.description ?? "",
        publishedAt: item.snippet.publishedAt ?? "",
      });
    }
  } catch {
    return [];
  }

  if (ids.length === 0) return [];

  // Second call confirms each video is still public and embeddable. Search
  // results can include videos that have since been pulled or restricted.
  const detailParams = new URLSearchParams({
    part: "status,statistics",
    id: ids.slice(0, limit * 3).join(","),
    key: process.env.YOUTUBE_API_KEY!,
  });
  const detailRes = await fetchWithTimeout(`${YOUTUBE_VIDEOS}?${detailParams}`);
  if (!detailRes?.ok) return [];

  const playable = new Set<string>();
  try {
    const json = (await detailRes.json()) as {
      items?: { id?: string; status?: { privacyStatus?: string; embeddable?: boolean } }[];
    };
    for (const item of json.items ?? []) {
      if (item.id && item.status?.privacyStatus === "public" && item.status?.embeddable) {
        playable.add(item.id);
      }
    }
  } catch {
    return [];
  }

  return ids
    .filter((id) => playable.has(id))
    .slice(0, limit)
    .map((id) => {
      const s = snippets.get(id)!;
      const year = s.publishedAt ? Number(s.publishedAt.slice(0, 4)) : null;
      return {
        id: `yt:${id}`,
        kind: "video" as const,
        provenance: "verified" as const,
        title: decodeEntities(s.title),
        url: `https://www.youtube.com/watch?v=${id}`,
        source: s.channelTitle || null,
        year: Number.isFinite(year) ? year : null,
        authors: [],
        summary: s.description ? decodeEntities(s.description).slice(0, 220) : null,
        why: `Matched to "${query.misconceptionName ?? query.conceptName}" — the misconception behind your gap, not just the topic.`,
      };
    });
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
