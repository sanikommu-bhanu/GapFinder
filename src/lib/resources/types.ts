/**
 * The resource layer.
 *
 * Everything surfaced here is a real, reachable thing on the internet. That
 * constraint drives the whole design: a model is never asked to produce a URL,
 * a title, an author or a DOI, because a fabricated citation that looks correct
 * is worse than no citation at all — a student would cite it.
 *
 * So resources come from provider APIs that return verified metadata, and each
 * one carries how it was obtained. Where a provider isn't configured, the layer
 * says so and offers a targeted search instead of inventing a result.
 */

export type ResourceKind = "video" | "paper" | "article" | "interactive";

export type ResourceProvenance =
  /** Returned by a provider API with real metadata. Safe to display in full. */
  | "verified"
  /** No provider configured — a targeted search the student can run themselves. */
  | "search";

export interface LearningResource {
  id: string;
  kind: ResourceKind;
  provenance: ResourceProvenance;
  title: string;
  url: string;
  /** Channel, journal or publisher — whoever is actually responsible for it. */
  source: string | null;
  year: number | null;
  authors: string[];
  /** The provider's own summary, trimmed. Never model-written. */
  summary: string | null;
  /**
   * Why this was surfaced for this student. Assembled from the diagnosis, so
   * it is specific and checkable rather than "this looks relevant".
   */
  why: string;
}

export interface ResourceQuery {
  conceptName: string;
  conceptSlug: string;
  subject: string;
  /** The catalogue misconception, when one was identified. */
  misconceptionName?: string;
  /** The rule the student was actually applying. */
  studentRule?: string;
}

export interface ResourceBundle {
  videos: LearningResource[];
  papers: LearningResource[];
  /**
   * Real-world code, for the subjects where reading a repository is genuinely
   * the better explanation. Optional because bundles cached before this field
   * existed will not have it — every consumer must treat it as possibly absent.
   */
  code?: LearningResource[];
  /** Providers that were asked but couldn't answer, with the reason. */
  unavailable: { provider: string; reason: string }[];
}
