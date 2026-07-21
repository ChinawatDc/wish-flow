import { describe, expect, it } from "vitest";

import { sanitizeMetadata } from "@/lib/log-sanitize";

describe("sanitizeMetadata", () => {
  it("ตัด key อันตราย: password / pin / token / secret / authorization / cookie", () => {
    const out = sanitizeMetadata({
      password: "p@ss",
      newPassword: "x",
      pin: "123456",
      securityPin: "654321",
      token: "abc",
      accessToken: "xyz",
      secret: "s",
      authorization: "Bearer abc",
      cookie: "session=1",
      apiKey: "k",
      safe: "keep-me",
      count: 3,
    });
    expect(out).toEqual({ safe: "keep-me", count: 3 });
  });

  it("ตัด key อันตรายแบบ nested", () => {
    const out = sanitizeMetadata({
      level1: {
        password: "leak",
        keep: true,
        level2: {
          stepUpToken: "leak2",
          name: "ok",
          items: [{ pin: "111111", label: "a" }],
        },
      },
    });
    expect(out).toEqual({
      level1: {
        keep: true,
        level2: { name: "ok", items: [{ label: "a" }] },
      },
    });
  });

  it("รับ input ที่ไม่ใช่ object โดยไม่พัง", () => {
    expect(sanitizeMetadata(null)).toEqual({});
    expect(sanitizeMetadata(undefined)).toEqual({});
    expect(sanitizeMetadata("string")).toEqual({});
    expect(sanitizeMetadata(42)).toEqual({});
  });

  it("ตัด string ยาวเกิน", () => {
    const out = sanitizeMetadata({ long: "a".repeat(1000) });
    expect((out.long as string).length).toBeLessThanOrEqual(501);
  });
});
