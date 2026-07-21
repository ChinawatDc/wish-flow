import { randomUUID } from "crypto";
import { afterAll, describe, expect, it, beforeAll } from "vitest";

import {
  deleteAsset,
  listAssets,
  reorderAssets,
  uploadAsset,
} from "@/lib/asset-service";
import { createEvent } from "@/lib/event-service";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import {
  searchTemplates,
  templateQuerySchema,
} from "@/lib/template-service";

const hasDb = Boolean(process.env.DATABASE_URL);

function jpegBuffer(size = 200): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

describe.runIf(hasDb)("asset-service integration (Postgres + local storage)", () => {
  const ownerToken = `owner-${randomUUID()}`;
  const strangerToken = `stranger-${randomUUID()}`;
  let eventId = "";
  let assetId = "";

  beforeAll(async () => {
    const created = await createEvent({ deviceToken: ownerToken, name: "Asset Test" });
    eventId = created.event.id;
    // stranger ต้องมี creator record (เหมือนเปิดเว็บครั้งแรก)
    await prisma.creator.create({ data: { deviceToken: strangerToken } });
  });

  afterAll(async () => {
    for (const token of [ownerToken, strangerToken]) {
      const creator = await prisma.creator.findUnique({ where: { deviceToken: token } });
      if (creator) {
        const events = await prisma.event.findMany({ where: { creatorId: creator.id } });
        for (const e of events) {
          const assets = await prisma.eventAsset.findMany({ where: { eventId: e.id } });
          for (const a of assets) await storage.delete(a.url);
        }
        await prisma.event.deleteMany({ where: { creatorId: creator.id } });
        await prisma.creator.delete({ where: { id: creator.id } });
      }
    }
    await prisma.$disconnect();
  });

  it("อัปโหลดรูปสำเร็จ เก็บ metadata + ตั้งชื่อไฟล์ใหม่เป็น UUID", async () => {
    const result = await uploadAsset({
      deviceToken: ownerToken,
      eventId,
      buffer: jpegBuffer(),
      declaredMime: "image/jpeg",
      originalName: "my photo (1).jpg",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    assetId = result.asset.id;
    // ชื่อไฟล์ต้องเป็น UUID ไม่ใช่ชื่อจากผู้ใช้
    expect(result.asset.url).not.toContain("my photo");
    expect(result.asset.url).toMatch(
      /\/api\/uploads\/events\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/,
    );
    // ไฟล์ต้องอ่านกลับได้จริง
    const stored = await storage.read(result.asset.url);
    expect(stored).not.toBeNull();
  });

  it("ปฏิเสธไฟล์ปลอม (magic bytes ไม่ใช่รูป)", async () => {
    const result = await uploadAsset({
      deviceToken: ownerToken,
      eventId,
      buffer: Buffer.from("<?php echo 'evil'; ?> padding padding"),
      declaredMime: "image/jpeg",
      originalName: "evil.jpg",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("คนอื่นอัปโหลดรูปเข้า event ที่ไม่ใช่ของตัวเองไม่ได้ (ownership)", async () => {
    const result = await uploadAsset({
      deviceToken: strangerToken,
      eventId,
      buffer: jpegBuffer(),
      declaredMime: "image/jpeg",
      originalName: "hack.jpg",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("คนอื่นลบรูปไม่ได้ (ownership)", async () => {
    const result = await deleteAsset({
      deviceToken: strangerToken,
      eventId,
      assetId,
    });
    expect(result.ok).toBe(false);
  });

  it("เปลี่ยนลำดับรูปได้ และปฏิเสธลำดับที่ id ไม่ครบ", async () => {
    const second = await uploadAsset({
      deviceToken: ownerToken,
      eventId,
      buffer: jpegBuffer(),
      declaredMime: "image/jpeg",
      originalName: "two.jpg",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const reversed = await reorderAssets({
      deviceToken: ownerToken,
      eventId,
      orderedIds: [second.asset.id, assetId],
    });
    expect(reversed.ok).toBe(true);

    const assets = await listAssets(eventId);
    expect(assets[0].id).toBe(second.asset.id);
    expect(assets[1].id).toBe(assetId);

    const bad = await reorderAssets({
      deviceToken: ownerToken,
      eventId,
      orderedIds: [assetId],
    });
    expect(bad.ok).toBe(false);
  });

  it("เจ้าของลบรูปได้ ลบทั้งไฟล์และ DB row", async () => {
    const before = await listAssets(eventId);
    const target = before.find((a) => a.id === assetId)!;

    const result = await deleteAsset({
      deviceToken: ownerToken,
      eventId,
      assetId,
    });
    expect(result.ok).toBe(true);

    const after = await listAssets(eventId);
    expect(after.find((a) => a.id === assetId)).toBeUndefined();
    // ไฟล์ต้องหายจาก storage ด้วย
    expect(await storage.read(target.url)).toBeNull();
  });
});

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

  it("ปฏิเสธ page ติดลบ", () => {
    expect(templateQuerySchema.safeParse({ page: "-1" }).success).toBe(false);
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

  it("pagination ทำงาน — limit 3 ต้องได้ไม่เกิน 3 และ totalPages ถูกต้อง", async () => {
    const page1 = await searchTemplates(templateQuerySchema.parse({ limit: "3" }));
    expect(page1.items.length).toBeLessThanOrEqual(3);
    expect(page1.totalPages).toBe(Math.max(1, Math.ceil(page1.total / 3)));

    if (page1.totalPages > 1) {
      const page2 = await searchTemplates(
        templateQuerySchema.parse({ limit: "3", page: "2" }),
      );
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    }
  });

  it("filter hasGame=true คืนเฉพาะเทมเพลตที่มีมินิเกม", async () => {
    const result = await searchTemplates(
      templateQuerySchema.parse({ hasGame: "true" }),
    );
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((t) => t.hasGame)).toBe(true);
  });

  it("sort popular เรียงตาม usageCount มาก → น้อย", async () => {
    const result = await searchTemplates(
      templateQuerySchema.parse({ sort: "popular" }),
    );
    const counts = result.items.map((t) => t.usageCount);
    const sorted = [...counts].sort((a, b) => b - a);
    expect(counts).toEqual(sorted);
  });
});
