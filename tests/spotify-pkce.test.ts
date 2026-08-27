import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { createVerifier, challengeFor } from "@/lib/spotify/pkce";

/**
 * PKCE is the part of the Spotify flow that has no visible symptom when it is
 * subtly wrong — a malformed challenge fails at Spotify's end with a generic
 * error, long after the mistake. These pin the format precisely.
 */

describe("PKCE verifier", () => {
  it("satisfies the RFC 7636 length bounds", () => {
    const verifier = createVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it("uses only unreserved characters", () => {
    // Anything outside this set is rejected by the spec, and "+" or "/" from
    // unconverted base64 is the classic way this breaks.
    for (let i = 0; i < 50; i++) {
      expect(createVerifier()).toMatch(/^[A-Za-z0-9\-._~]+$/);
    }
  });

  it("is different every time", () => {
    const seen = new Set(Array.from({ length: 100 }, () => createVerifier()));
    expect(seen.size).toBe(100);
  });
});

describe("PKCE challenge", () => {
  it("is the base64url-encoded SHA-256 of the verifier", () => {
    const verifier = createVerifier();
    const expected = createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(challengeFor(verifier)).toBe(expected);
  });

  it("carries no base64 padding or URL-unsafe characters", () => {
    for (let i = 0; i < 50; i++) {
      const challenge = challengeFor(createVerifier());
      expect(challenge).not.toContain("=");
      expect(challenge).not.toContain("+");
      expect(challenge).not.toContain("/");
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });

  it("is a fixed 43 characters — SHA-256 is always 32 bytes", () => {
    expect(challengeFor(createVerifier())).toHaveLength(43);
  });

  it("is deterministic for a given verifier", () => {
    // The whole mechanism depends on this: Spotify recomputes the hash at
    // redemption and compares it to what was sent at authorize time.
    const verifier = createVerifier();
    expect(challengeFor(verifier)).toBe(challengeFor(verifier));
  });

  it("differs for different verifiers", () => {
    expect(challengeFor(createVerifier())).not.toBe(challengeFor(createVerifier()));
  });

  it("matches the RFC 7636 Appendix B test vector", () => {
    // The canonical example from the spec — proves the encoding end to end.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(challengeFor(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
