import { describe, it, expect } from "vitest";
import { supportsSubject } from "@/lib/resources/providers/github";
import { conceptTerms, hasUsableAnchors, isRelevant } from "@/lib/resources/providers/research";
import type { LearningResource, ResourceQuery } from "@/lib/resources/types";

/**
 * The resource layer's job is to be *right or silent*. These tests pin the
 * silences: the cases where returning nothing is the correct answer, because a
 * confidently irrelevant result is the failure mode that costs a student's
 * trust permanently.
 */

function query(overrides: Partial<ResourceQuery> = {}): ResourceQuery {
  return {
    conceptName: "Distributive Property",
    conceptSlug: "distribution",
    subject: "Math",
    ...overrides,
  };
}

function resource(overrides: Partial<LearningResource> = {}): LearningResource {
  return {
    id: "test",
    kind: "paper",
    provenance: "verified",
    title: "A paper",
    url: "https://doi.org/10.1234/x",
    source: null,
    year: 2020,
    authors: [],
    summary: null,
    why: "",
    ...overrides,
  };
}

describe("GitHub subject gating", () => {
  it("offers repositories for the subjects where code is the better explanation", () => {
    expect(supportsSubject(query({ subject: "Computer Science" }))).toBe(true);
    expect(supportsSubject(query({ subject: "Engineering" }))).toBe(true);
  });

  it("declines subjects a repository cannot illuminate", () => {
    for (const subject of ["Math", "Physics", "Chemistry", "Biology"]) {
      expect(supportsSubject(query({ subject }))).toBe(false);
    }
  });

  it("is case- and whitespace-insensitive, since subject strings come from the UI", () => {
    expect(supportsSubject(query({ subject: "  computer science  " }))).toBe(true);
  });
});

describe("research relevance gate", () => {
  it("keeps a paper that is both on-concept and about teaching", () => {
    const paper = resource({
      title: "Student misconceptions of the distributive property",
      summary: "A classroom study of learner errors.",
    });
    expect(isRelevant(paper, query())).toBe(true);
  });

  it("drops a pure-maths paper that merely shares the word", () => {
    // "Distributive lattices" is on-topic by keyword and teaches a student
    // nothing about the algebra mistake they actually made.
    const paper = resource({
      title: "On distributive lattices in category theory",
      summary: "We prove a representation theorem.",
    });
    expect(isRelevant(paper, query())).toBe(false);
  });

  it("drops an education paper about an unrelated concept", () => {
    const paper = resource({
      title: "Student misconceptions in cellular respiration",
      summary: "A classroom study of learner errors.",
    });
    expect(isRelevant(paper, query())).toBe(false);
  });

  it("refuses to search when a concept has no distinctive term", () => {
    // Anchors are all generic ("problem", "solving"), so any result would be
    // matched on filler. Returning nothing is the correct outcome.
    expect(hasUsableAnchors(query({ conceptSlug: "unknown-slug", conceptName: "problem solving" }))).toBe(
      false
    );
  });

  it("finds usable anchors for a seeded concept", () => {
    expect(hasUsableAnchors(query())).toBe(true);
    expect(conceptTerms(query())).toContain("distributive property");
  });
});
