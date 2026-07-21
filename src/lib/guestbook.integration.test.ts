import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { duplicateOwnedEvent } from "@/lib/event-service";
import {
  authorizeGuestbookPhotoRead,
  bulkModerateGuestbook,
  deleteGuestbookEntry,
  getGuestbookPublicMeta,
  listApprovedWall,
  listGuestbookForOwner,
  moderateGuestbookEntry,
  submitGuestbookEntry,
} from "@/lib/guestbook-service";
import { storage } from "@/lib/storage";

const hasDb = Boolean(process.env.DATABASE_URL);

/** Minimal buffer with JPEG magic bytes (passes validateUpload) */
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

describe.runIf(hasDb)("guestbook-service integration", () => {
  let ownerId = "";
  let otherId = "";
  let eventId = "";
  let entryId = "";
  let photoEntryId = "";

  beforeAll(async () => {
    const owner = await makeUser("gb-owner");
    const other = await makeUser("gb-other");
    ownerId = owner.id;
    otherId = other.id;

    const event = await prisma.event.create({
      data: {
        name: "Wedding Guestbook Test",
        ownerUserId: ownerId,
        claimedAt: new Date(),
        pinHash: "$2a$10$abcdefghijklmnopqrstuv", // unused in PUBLIC
        status: "active",
        guestAccessMode: "PUBLIC",
        guestbookEnabled: true,
      },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    if (eventId) {
      const photos = await prisma.guestbookEntry.findMany({
        where: { eventId },
        select: { photoUrl: true },
      });
      for (const p of photos) {
        if (p.photoUrl) await storage.delete(p.photoUrl);
      }
      await prisma.guestbookEntry.deleteMany({ where: { eventId } });
      await prisma.event.delete({ where: { id: eventId } }).catch(() => {});
    }
    for (const id of [ownerId, otherId]) {
      if (!id) continue;
      await prisma.event.deleteMany({ where: { ownerUserId: id } });
      await prisma.appNotification.deleteMany({ where: { userId: id } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: id } });
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("meta allows submit when PUBLIC + guestbook enabled + active", async () => {
    const meta = await getGuestbookPublicMeta(eventId);
    expect("error" in meta).toBe(false);
    if ("error" in meta) return;
    expect(meta.canSubmit).toBe(true);
  });

  it("blocks draft / disabled / PIN mode", async () => {
    await prisma.event.update({
      where: { id: eventId },
      data: { status: "draft" },
    });
    let meta = await getGuestbookPublicMeta(eventId);
    expect("error" in meta ? null : meta.canSubmit).toBe(false);

    await prisma.event.update({
      where: { id: eventId },
      data: { status: "active", guestbookEnabled: false },
    });
    meta = await getGuestbookPublicMeta(eventId);
    expect("error" in meta ? null : meta.canSubmit).toBe(false);

    await prisma.event.update({
      where: { id: eventId },
      data: {
        guestbookEnabled: true,
        guestAccessMode: "PIN",
      },
    });
    meta = await getGuestbookPublicMeta(eventId);
    expect("error" in meta ? null : meta.canSubmit).toBe(false);

    await prisma.event.update({
      where: { id: eventId },
      data: { guestAccessMode: "PUBLIC", guestbookEnabled: true },
    });
  });

  it("submits optional name without photo → PENDING not on wall", async () => {
    const result = await submitGuestbookEntry({
      eventId,
      displayName: "แขก A",
      message: "ขอให้มีความสุข",
      ipHash: "ip-hash-a",
      deviceId: randomUUID(),
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    entryId = result.entry.id;
    expect(result.entry.status).toBe("PENDING");

    const wall = await listApprovedWall({ eventId });
    expect("error" in wall).toBe(false);
    if ("error" in wall) return;
    expect(wall.entries.find((e) => e.id === entryId)).toBeUndefined();

    const notif = await prisma.appNotification.findFirst({
      where: { userId: ownerId, href: { contains: eventId } },
    });
    expect(notif).toBeTruthy();
  });

  it("owner-only list/moderate; approve → wall; hide removes", async () => {
    const denied = await listGuestbookForOwner({
      userId: otherId,
      eventId,
    });
    expect(denied).toEqual({ error: "not_found" });

    const list = await listGuestbookForOwner({
      userId: ownerId,
      eventId,
      status: "PENDING",
    });
    expect("error" in list).toBe(false);
    if ("error" in list) return;
    expect(list.entries.some((e) => e.id === entryId)).toBe(true);

    const approved = await moderateGuestbookEntry({
      userId: ownerId,
      eventId,
      entryId,
      status: "APPROVED",
    });
    expect("error" in approved).toBe(false);

    let wall = await listApprovedWall({ eventId });
    expect("error" in wall).toBe(false);
    if ("error" in wall) return;
    expect(wall.entries.find((e) => e.id === entryId)?.message).toBe(
      "ขอให้มีความสุข",
    );

    await moderateGuestbookEntry({
      userId: ownerId,
      eventId,
      entryId,
      status: "HIDDEN",
    });
    wall = await listApprovedWall({ eventId });
    expect("error" in wall).toBe(false);
    if ("error" in wall) return;
    expect(wall.entries.find((e) => e.id === entryId)).toBeUndefined();
  });

  it("accepts photo upload and ACL: pending forbidden to public, approved ok", async () => {
    const result = await submitGuestbookEntry({
      eventId,
      message: "พร้อมรูป",
      photo: {
        buffer: jpegBuffer(),
        declaredMime: "image/jpeg",
        originalName: "wish.jpg",
      },
      ipHash: "ip-hash-photo",
      deviceId: randomUUID(),
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    photoEntryId = result.entry.id;

    const entry = await prisma.guestbookEntry.findUnique({
      where: { id: photoEntryId },
    });
    expect(entry?.photoUrl).toMatch(/^\/api\/uploads\/guestbook\//);

    let authz = await authorizeGuestbookPhotoRead({
      eventId,
      entryId: photoEntryId,
      viewerUserId: null,
    });
    expect(authz.ok).toBe(false);

    authz = await authorizeGuestbookPhotoRead({
      eventId,
      entryId: photoEntryId,
      viewerUserId: ownerId,
    });
    expect(authz.ok).toBe(true);

    await moderateGuestbookEntry({
      userId: ownerId,
      eventId,
      entryId: photoEntryId,
      status: "APPROVED",
    });

    authz = await authorizeGuestbookPhotoRead({
      eventId,
      entryId: photoEntryId,
      viewerUserId: null,
    });
    expect(authz.ok).toBe(true);
  });

  it("rejects invalid upload", async () => {
    const result = await submitGuestbookEntry({
      eventId,
      message: "bad file",
      photo: {
        buffer: Buffer.from("not-an-image"),
        declaredMime: "image/jpeg",
        originalName: "x.jpg",
      },
      deviceId: randomUUID(),
    });
    expect(result).toMatchObject({ error: "invalid_upload" });
  });

  it("rate limits by ip/device", async () => {
    const deviceId = randomUUID();
    const ipHash = `rl-${randomUUID()}`;
    for (let i = 0; i < 5; i++) {
      const r = await submitGuestbookEntry({
        eventId,
        message: `rate ${i}`,
        ipHash,
        deviceId,
      });
      expect("error" in r).toBe(false);
    }
    const limited = await submitGuestbookEntry({
      eventId,
      message: "too many",
      ipHash,
      deviceId,
    });
    expect(limited).toEqual({ error: "rate_limited" });
  });

  it("bulk moderate respects max 50 and reject clears photo", async () => {
    const over = await bulkModerateGuestbook({
      userId: ownerId,
      eventId,
      ids: Array.from({ length: 51 }, () => randomUUID()),
      status: "APPROVED",
    });
    expect(over).toEqual({ error: "bulk_limit" });

    const before = await prisma.guestbookEntry.findUnique({
      where: { id: photoEntryId },
    });
    expect(before?.photoUrl).toBeTruthy();

    const rejected = await moderateGuestbookEntry({
      userId: ownerId,
      eventId,
      entryId: photoEntryId,
      status: "REJECTED",
    });
    expect("error" in rejected).toBe(false);

    const after = await prisma.guestbookEntry.findUnique({
      where: { id: photoEntryId },
    });
    expect(after?.photoUrl).toBeNull();
    expect(after?.status).toBe("REJECTED");
  });

  it("blocks expired and draft submit", async () => {
    await prisma.event.update({
      where: { id: eventId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    let r = await submitGuestbookEntry({
      eventId,
      message: "late",
      deviceId: randomUUID(),
    });
    expect(r).toEqual({ error: "expired" });

    await prisma.event.update({
      where: { id: eventId },
      data: { expiresAt: null, status: "draft" },
    });
    r = await submitGuestbookEntry({
      eventId,
      message: "draft",
      deviceId: randomUUID(),
    });
    expect(r).toEqual({ error: "inactive" });

    await prisma.event.update({
      where: { id: eventId },
      data: { status: "active" },
    });
  });

  it("duplicate does not copy guestbook entries", async () => {
    const before = await prisma.guestbookEntry.count({ where: { eventId } });
    expect(before).toBeGreaterThan(0);

    const dup = await duplicateOwnedEvent(ownerId, eventId);
    expect("error" in dup).toBe(false);
    if ("error" in dup) return;

    const copied = await prisma.guestbookEntry.count({
      where: { eventId: dup.event.id },
    });
    expect(copied).toBe(0);
    expect(dup.event.guestAccessMode).toBe("PIN"); // default on new create — wait, duplicate copies fields?

    // duplicateOwnedEvent currently does NOT copy guestAccessMode — defaults PIN
    // which is correct: guestbook state is live event data, not cloned wishes
    await prisma.event.delete({ where: { id: dup.event.id } });
  });

  it("delete entry removes row; audit has no message body", async () => {
    const created = await submitGuestbookEntry({
      eventId,
      message: "ลบฉัน",
      deviceId: randomUUID(),
    });
    expect("error" in created).toBe(false);
    if ("error" in created) return;

    await deleteGuestbookEntry({
      userId: ownerId,
      eventId,
      entryId: created.entry.id,
    });

    const gone = await prisma.guestbookEntry.findUnique({
      where: { id: created.entry.id },
    });
    expect(gone).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "GUESTBOOK.SUBMIT",
        resourceId: created.entry.id,
      },
    });
    expect(audit).toBeTruthy();
    const meta = (audit?.metadata ?? {}) as Record<string, unknown>;
    expect(meta.message).toBeUndefined();
    expect(JSON.stringify(meta)).not.toContain("ลบฉัน");
  });
});
