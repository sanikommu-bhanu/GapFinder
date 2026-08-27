import type { LearningResource, ResourceQuery } from "./types";

/**
 * The resource provider registry.
 *
 * Before this existed, `getResources` named Crossref, arXiv and YouTube
 * directly, so adding a source meant editing the aggregator, the bundle type
 * and the error handling together. Every provider now declares the same four
 * things, and the aggregator maps over whatever is registered without knowing
 * what any of them are.
 *
 * The contract is deliberately narrow. A provider gets the diagnosis and a
 * limit; it returns real resources or it throws. It does not cache (the
 * aggregator does), it does not decide relevance ordering across providers
 * (the ranker does), and it never reports a partial result as a success —
 * throwing is how a provider says "ask me again later", which is what puts it
 * in `unavailable` with a reason instead of silently contributing nothing.
 */
export interface ResourceProvider {
  /** Stable id, used in cache keys and the `unavailable` list. */
  id: string;
  /** Shown to the student when this provider couldn't answer. */
  label: string;
  /** What this provider contributes, for grouping in the UI. */
  kind: "video" | "paper" | "code";
  /** False when a required key is absent — the provider is then skipped, not failed. */
  isConfigured(): boolean;
  /**
   * Subject gating. GitHub repositories illuminate a graph-algorithms gap and
   * tell a student nothing about photosynthesis, so a provider may decline a
   * subject rather than return weak results for it.
   */
  supports(query: ResourceQuery): boolean;
  search(query: ResourceQuery, limit: number): Promise<LearningResource[]>;
}

/** How many results each provider may contribute to one bundle. */
export interface ProviderBudget {
  [providerId: string]: number;
}
