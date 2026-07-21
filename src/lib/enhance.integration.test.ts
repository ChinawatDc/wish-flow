import { describe, expect, it } from "vitest";

import {
  searchTemplates,
  templateQuerySchema,
} from "@/lib/template-service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe("templateQuerySchema validation", () => {
  it("ค่า default ถูกต้อง", () => {
    const parsed = templateQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(12);
    expect(parsed.sort).toBe("recommended");
  });

  it("จำกัด limit สูงสุด 24", () => {
    expect(templateQuerySchema.safeParse({ limit: "100" }).success).toBe(false);
    expect(templateQuerySchema.safeParse({ limit: "24" }).success).toBe(true);
  });

  it("ปฏิเสธ category / sort ที่ไม่รู้จัก", () => {
    expect(templateQuerySchema.safeParse({ category: "hack" }).success).toBe(false);
    expect(templateQuerySchema.safeParse({ sort: "cheapest" }).success).toBe(false);
  });
});

describe.runIf(hasDb)("template search integration (Postgres)", () => {
  it("ค้นหาด้วยคำค้นเจอเทมเพลตที่เกี่ยวข้อง", async () => {
    const result = await searchTemplates(
      templateQuerySchema.parse({ q: "โพลารอยด์" }),
    );
    expect(result.items.some((t) => t.slug === "polaroid-album")).toBe(true);
  });

  it("filter ตาม category ได้", async () => {
    const result = await searchTemplates(
      templateQuerySchema.parse({ category: "minigame" }),
    );
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((t) => t.category === "minigame")).toBe(true);
  });

  it("pagination ทำงาน", async () => {
    const page1 = await searchTemplates(templateQuerySchema.parse({ limit: "3" }));
    expect(page1.items.length).toBeLessThanOrEqual(3);
    expect(page1.totalPages).toBe(Math.max(1, Math.ceil(page1.total / 3)));
  });

  it("filter hasGame=true", async () => {
    const result = await searchTemplates(
      templateQuerySchema.parse({ hasGame: "true" }),
    );
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((t) => t.hasGame)).toBe(true);
  });
});
