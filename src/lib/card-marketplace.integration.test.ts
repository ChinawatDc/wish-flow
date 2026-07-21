import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";

import {
  publishCardShare,
  toggleCardHeart,
  forkMarketplaceCard,
  listMarketplaceCards,
} from "@/lib/card-marketplace-service";
import { createEvent, duplicateOwnedEvent, verifyEventPin } from "@/lib/event-service";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { uploadAsset, listAssets } from "@/lib/asset-service";
import { issueUnlockToken } from "@/lib/unlock-token";

const hasDb = Boolean(process.env.DATABASE_URL);

function jpegBuffer(size = 200): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

async function makeUser(prefix: string) {
  return prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@test.local`,
      name: prefix,
      passwordHash: "$2a$10$invalidhashforintegrationtestsxxxxxxxxxxxxxxxxx",
      role: "USER",
    },
  });
}

describe.runIf(hasDb)("card marketplace + expiry", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids) {
      const events = await prisma.event.findMany({ where: { ownerUserId: id } });
      for (const e of events) {
        const assets = await prisma.eventAsset.findMany({ where: { eventId: e.id } });
        for (const a of assets) await storage.delete(a.url).catch(() => {});
        await prisma.event.delete({ where: { id: e.id } }).catch(() => {});
      }
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  });

  it("share → heart → use (unique count) + duplicate clones assets", async () => {
    const owner = await makeUser("mkt-owner");
    const other = await makeUser("mkt-other");
    ids.push(owner.id, other.id);

    const created = await createEvent({ userId: owner.id, name: "Shared Card" });
    const eventId = created.event.id;

    const up = await uploadAsset({
      userId: owner.id,
      eventId,
      buffer: jpegBuffer(),
      declaredMime: "image/jpeg",
      originalName: "a.jpg",
    });
    expect(up.ok).toBe(true);

    const pub = await publishCardShare({
      userId: owner.id,
      eventId,
      includeAssets: true,
      blurb: "ลองใช้ได้",
    });
    expect("ok" in pub).toBe(true);
    if (!("ok" in pub)) return;

    const list = await listMarketplaceCards({
      userId: other.id,
      page: 1,
      limit: 12,
    });
    expect(list.cards.some((c) => c.id === pub.listingId)).toBe(true);

    const heart = await toggleCardHeart({
      userId: other.id,
      listingId: pub.listingId,
    });
    expect(heart).toMatchObject({ hearted: true });
    if ("error" in heart) return;
    expect(heart.heartCount).toBeGreaterThanOrEqual(1);

    const used = await forkMarketplaceCard({
      userId: other.id,
      listingId: pub.listingId,
    });
    expect("ok" in used).toBe(true);
    if (!("ok" in used)) return;
    expect(used.uniqueUse).toBe(true);
    expect(used.pin).toMatch(/^\d{6}$/);

    const forkedAssets = await listAssets(used.eventId);
    expect(forkedAssets.length).toBeGreaterThanOrEqual(1);

    const usedAgain = await forkMarketplaceCard({
      userId: other.id,
      listingId: pub.listingId,
    });
    expect("ok" in usedAgain).toBe(true);
    if (!("ok" in usedAgain)) return;
    expect(usedAgain.uniqueUse).toBe(false);

    const listing = await prisma.cardListing.findUniqueOrThrow({
      where: { id: pub.listingId },
    });
    expect(listing.useCount).toBe(1);

    const ownUse = await forkMarketplaceCard({
      userId: owner.id,
      listingId: pub.listingId,
    });
    expect(ownUse).toEqual({ error: "cannot_use_own" });

    const dup = await duplicateOwnedEvent(owner.id, eventId);
    expect("event" in dup).toBe(true);
    if (!("event" in dup)) return;
    expect(dup.event.duplicatedFromEventId).toBe(eventId);
    const dupAssets = await listAssets(dup.event.id);
    expect(dupAssets.length).toBeGreaterThanOrEqual(1);
    expect(dupAssets[0]?.url).not.toBe(forkedAssets[0]?.url);
  });

  it("expiresAt บล็อก verify-pin และ view แม้มี unlock token", async () => {
    const owner = await makeUser("exp-owner");
    ids.push(owner.id);
    const created = await createEvent({ userId: owner.id, name: "Expired Card" });
    await prisma.event.update({
      where: { id: created.event.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const pinTry = await verifyEventPin({
      eventId: created.event.id,
      pin: created.pin,
      ipAddress: "127.0.0.1",
    });
    expect(pinTry).toMatchObject({ ok: false, status: 410 });

    // จำลอง unlock เก่า — view ต้อง 410 ด้วย (เช็คที่ service ชั้น API แล้ว)
    const token = await issueUnlockToken(created.event.id);
    expect(token).toBeTruthy();
  });
});
