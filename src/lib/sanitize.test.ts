import { describe, expect, it } from "vitest";

import { sanitizeTemplateData, sanitizeText } from "@/lib/sanitize";
import { issueUnlockToken, verifyUnlockToken } from "@/lib/unlock-token";
import { createEventSchema, parseStepsSchema, verifyPinSchema } from "@/lib/validation";

describe("sanitizeText", () => {
  it("escapes HTML entities", () => {
    expect(sanitizeText(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });
});

describe("sanitizeTemplateData", () => {
  it("sanitizes nested string fields", () => {
    const out = sanitizeTemplateData({
      title_text: "<b>Hi</b>",
      nested: { message_text: "A & B" },
    });
    expect(out.title_text).toBe("&lt;b&gt;Hi&lt;/b&gt;");
    expect((out.nested as Record<string, string>).message_text).toBe("A &amp; B");
  });
});

describe("validation", () => {
  it("accepts create event name", () => {
    expect(createEventSchema.parse({ name: " Birthday " }).name).toBe("Birthday");
  });

  it("rejects bad pin", () => {
    expect(verifyPinSchema.safeParse({ pin: "12" }).success).toBe(false);
    expect(verifyPinSchema.safeParse({ pin: "123456" }).success).toBe(true);
  });

  it("parses steps schema", () => {
    const parsed = parseStepsSchema({
      steps: [{ key: "opening", type: "gift-box", fields: ["title_text"] }],
    });
    expect(parsed.steps).toHaveLength(1);
  });
});

describe("unlock token", () => {
  it("issues and verifies for matching event", async () => {
    process.env.UNLOCK_JWT_SECRET ??= "test-secret";
    const eventId = "11111111-1111-4111-8111-111111111111";
    const token = await issueUnlockToken(eventId);
    expect(await verifyUnlockToken(token, eventId)).toBe(true);
    expect(
      await verifyUnlockToken(token, "22222222-2222-4222-8222-222222222222"),
    ).toBe(false);
  });
});
