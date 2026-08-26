import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AiUnavailableError, isWorthFailingOver } from "@/lib/ai/providers/types";
import { groqProvider } from "@/lib/ai/providers/groq";

/**
 * The cascade exists so a free-tier rate limit doesn't cost a student their
 * explanation. These pin the decisions that make that safe: when to move to
 * the next provider, and when NOT to silently swap in a weaker one.
 */

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});
beforeEach(() => {
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_ALLOW_VISION;
});

describe("failover decisions", () => {
  it("moves to the next provider on a rate limit", () => {
    expect(isWorthFailingOver(new AiUnavailableError("quota", "rate limited"))).toBe(true);
  });

  it("moves on when a model returns something unparseable", () => {
    // A different model may format the same request correctly.
    expect(isWorthFailingOver(new AiUnavailableError("invalid_response", "bad json"))).toBe(true);
  });

  it("moves on when a provider is unreachable", () => {
    expect(isWorthFailingOver(new AiUnavailableError("network", "timeout"))).toBe(true);
  });

  it("does NOT treat a missing key as a failure worth reporting", () => {
    // An unconfigured provider is skipped, not retried — it never had a chance
    // to fail, so it must not mask the real error from the provider that did.
    expect(isWorthFailingOver(new AiUnavailableError("no_key", "not configured"))).toBe(false);
  });

  it("fails over on an unexpected error type", () => {
    expect(isWorthFailingOver(new Error("something odd"))).toBe(true);
  });
});

describe("groq provider configuration", () => {
  it("reports itself unconfigured without a key", () => {
    expect(groqProvider.isConfigured()).toBe(false);
  });

  it("reports itself configured with a plausible key", () => {
    process.env.GROQ_API_KEY = "gsk_thisisalongenoughkeyvalue";
    expect(groqProvider.isConfigured()).toBe(true);
  });

  it("rejects an obviously truncated key", () => {
    process.env.GROQ_API_KEY = "short";
    expect(groqProvider.isConfigured()).toBe(false);
  });

  it("refuses images unless vision fallback is explicitly enabled", () => {
    process.env.GROQ_API_KEY = "gsk_thisisalongenoughkeyvalue";
    // Reading handwriting is where model quality visibly changes the answer,
    // so quietly falling back to a weaker reader would degrade the diagnosis
    // without telling anyone.
    expect(groqProvider.canHandle({ hasImage: true })).toBe(false);
    expect(groqProvider.canHandle({ hasImage: false })).toBe(true);
  });

  it("will not do vision on opt-in alone, without a vision model named", () => {
    process.env.GROQ_API_KEY = "gsk_thisisalongenoughkeyvalue";
    process.env.GROQ_ALLOW_VISION = "true";
    delete process.env.GROQ_VISION_MODEL;
    // Groq's catalogue rotates and its text models are not multimodal. Sending
    // a photograph to one would be a silent failure dressed as a fallback.
    expect(groqProvider.canHandle({ hasImage: true })).toBe(false);
  });

  it("accepts images once a vision model is named and opted into", () => {
    process.env.GROQ_API_KEY = "gsk_thisisalongenoughkeyvalue";
    process.env.GROQ_ALLOW_VISION = "true";
    process.env.GROQ_VISION_MODEL = "some/vision-capable-model";
    expect(groqProvider.canHandle({ hasImage: true })).toBe(true);
  });

  it("throws rather than silently doing nothing when asked for vision it can't do", async () => {
    process.env.GROQ_API_KEY = "gsk_thisisalongenoughkeyvalue";
    delete process.env.GROQ_ALLOW_VISION;
    delete process.env.GROQ_VISION_MODEL;
    await expect(
      groqProvider.generate({
        schema: (await import("zod")).z.object({ ok: (await import("zod")).z.boolean() }),
        systemInstruction: "s",
        prompt: "p",
        imageBase64: "abc",
      })
    ).rejects.toThrow(/vision/i);
  });

  it("keeps the image model separate from the text model when both are set", () => {
    process.env.GROQ_MODEL = "some/text-model";
    process.env.GROQ_VISION_MODEL = "some/vision-capable-model";
    expect(groqProvider.modelFor({ hasImage: true })).toBe("some/vision-capable-model");
    expect(groqProvider.modelFor({ hasImage: false })).toBe("some/text-model");
  });
});
