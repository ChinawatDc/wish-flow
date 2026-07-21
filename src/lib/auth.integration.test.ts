import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deleteAsset,
  listAssets,
  reorderAssets,
  uploadAsset,
} from "@/lib/asset-service";
import {
  claimDeviceEvents,
  listUsersForAdmin,
  registerUser,
  updateUserAsAdmin,
} from "@/lib/auth-service";
import { createEvent } from "@/lib/event-service";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

const hasDb = Boolean(process.env.DATABASE_URL);

function jpegBuffer(size = 200): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

async function makeUser(prefix: string, role: "USER" | "ADMIN" = "USER") {
  return prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@test.local`,
      name: prefix,
      passwordHash: "$2a$10$invalidhashforintegrationtestsxxxxxxxxxxxxxxxxx",
      role,
    },
  });
}

describe.runIf(hasDb)("asset-service integration (User ownership)", () => {
  let ownerId = "";
  let strangerId = "";
  let eventId = "";
  let assetId = "";

  beforeAll(async () => {
    const owner = await makeUser("asset-owner");
    const stranger = await makeUser("asset-stranger");
    ownerId = owner.id;
    strangerId = stranger.id;
    const created = await createEvent({ userId: ownerId, name: "Asset Test" });
    eventId = created.event.id;
  });

  afterAll(async () => {
    for (const id of [ownerId, strangerId]) {
      if (!id) continue;
      const events = await prisma.event.findMany({ where: { ownerUserId: id } });
      for (const e of events) {
        const assets = await prisma.eventAsset.findMany({ where: { eventId: e.id } });
        for (const a of assets) await storage.delete(a.url);
      }
      await prisma.event.deleteMany({ where: { ownerUserId: id } });
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  });

  it("อัปโหลดรูปสำเร็จ ชื่อไฟล์เป็น UUID", async () => {
    const result = await uploadAsset({
      userId: ownerId,
      eventId,
      buffer: jpegBuffer(),
      declaredMime: "image/jpeg",
      originalName: "my photo (1).jpg",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    assetId = result.asset.id;
    expect(result.asset.url).not.toContain("my photo");
    expect(await storage.read(result.asset.url)).not.toBeNull();
  });

  it("คนอื่นอัปโหลดเข้า event ของคนอื่นไม่ได้", async () => {
    const result = await uploadAsset({
      userId: strangerId,
      eventId,
      buffer: jpegBuffer(),
      declaredMime: "image/jpeg",
      originalName: "hack.jpg",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("คนอื่นลบรูปไม่ได้", async () => {
    const result = await deleteAsset({
      userId: strangerId,
      eventId,
      assetId,
    });
    expect(result.ok).toBe(false);
  });

  it("เปลี่ยนลำดับรูปได้", async () => {
    const second = await uploadAsset({
      userId: ownerId,
      eventId,
      buffer: jpegBuffer(),
      declaredMime: "image/jpeg",
      originalName: "two.jpg",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const reversed = await reorderAssets({
      userId: ownerId,
      eventId,
      orderedIds: [second.asset.id, assetId],
    });
    expect(reversed.ok).toBe(true);
    const assets = await listAssets(eventId);
    expect(assets[0].id).toBe(second.asset.id);
  });

  it("เจ้าของลบรูปได้", async () => {
    const before = await listAssets(eventId);
    const target = before.find((a) => a.id === assetId)!;
    const result = await deleteAsset({ userId: ownerId, eventId, assetId });
    expect(result.ok).toBe(true);
    expect(await storage.read(target.url)).toBeNull();
  });
});

describe.runIf(hasDb)("auth-service: register, claim, admin guards", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids) {
      await prisma.event.deleteMany({ where: { ownerUserId: id } });
      await prisma.account.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("register สร้าง user ด้วย password hash", async () => {
    const email = `reg-${randomUUID()}@test.local`;
    const result = await registerUser({
      email,
      password: "password123",
      name: "Tester",
    });
    expect("user" in result).toBe(true);
    if (!("user" in result) || !result.user) return;
    ids.push(result.user.id);

    const db = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
    expect(db.passwordHash).toBeTruthy();
    expect(db.passwordHash).not.toBe("password123");
    expect(db.role).toBe("USER");
  });

  it("register อีเมลซ้ำไม่ได้", async () => {
    const email = `dup-${randomUUID()}@test.local`;
    const first = await registerUser({ email, password: "password123" });
    if ("user" in first && first.user) ids.push(first.user.id);
    const second = await registerUser({ email, password: "password123" });
    expect(second).toEqual({ error: "email_taken" });
  });

  it("claim device events ครั้งเดียว", async () => {
    const user = await makeUser("claim-user");
    ids.push(user.id);
    const deviceToken = `device-${randomUUID()}`;
    const creator = await prisma.creator.create({ data: { deviceToken } });
    const legacy = await prisma.event.create({
      data: {
        name: "Legacy Card",
        creatorId: creator.id,
        pinHash: "$2a$10$abcdefghijklmnopqrstuv",
        templateData: {},
      },
    });

    const first = await claimDeviceEvents({ userId: user.id, deviceToken });
    expect(first.claimed).toBe(1);
    expect(first.eventIds).toContain(legacy.id);

    const second = await claimDeviceEvents({ userId: user.id, deviceToken });
    expect(second.claimed).toBe(0);

    const event = await prisma.event.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(event.ownerUserId).toBe(user.id);
    expect(event.claimedAt).toBeTruthy();
  });

  it("admin ไม่ลดสิทธิ์ตัวเอง", async () => {
    const admin = await makeUser("solo-admin", "ADMIN");
    ids.push(admin.id);

    const demoteSelf = await updateUserAsAdmin({
      actorId: admin.id,
      targetId: admin.id,
      role: "USER",
    });
    expect(demoteSelf).toEqual({ error: "cannot_demote_self" });

    const other = await makeUser("to-promote");
    ids.push(other.id);
    await updateUserAsAdmin({
      actorId: admin.id,
      targetId: other.id,
      role: "ADMIN",
    });

    const demote = await updateUserAsAdmin({
      actorId: other.id,
      targetId: admin.id,
      role: "USER",
    });
    expect("user" in demote).toBe(true);

    const last = await updateUserAsAdmin({
      actorId: other.id,
      targetId: other.id,
      role: "USER",
    });
    expect(last).toEqual({ error: "cannot_demote_self" });
  });

  it("admin ไม่ระงับตัวเอง และกัน last-admin", async () => {
    const solo = await makeUser("solo-suspend", "ADMIN");
    ids.push(solo.id);

    const selfSuspend = await updateUserAsAdmin({
      actorId: solo.id,
      targetId: solo.id,
      status: "SUSPENDED",
    });
    expect(selfSuspend).toEqual({ error: "cannot_suspend_self" });

    const peer = await makeUser("peer-admin", "ADMIN");
    ids.push(peer.id);

    const demoteOk = await updateUserAsAdmin({
      actorId: peer.id,
      targetId: solo.id,
      role: "USER",
    });
    expect("user" in demoteOk).toBe(true);

    const lastSuspendSelf = await updateUserAsAdmin({
      actorId: peer.id,
      targetId: peer.id,
      status: "SUSPENDED",
    });
    expect(lastSuspendSelf).toEqual({ error: "cannot_suspend_self" });

    const lastDemoteSelf = await updateUserAsAdmin({
      actorId: peer.id,
      targetId: peer.id,
      role: "USER",
    });
    expect(lastDemoteSelf).toEqual({ error: "cannot_demote_self" });

    // แยกสถานการณ์ last-admin: เหลือ ACTIVE ADMIN แค่คนเดียวใน DB
    const only = await makeUser("only-admin-left", "ADMIN");
    ids.push(only.id);
    const others = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE", id: { not: only.id } },
      select: { id: true },
    });
    const otherIds = others.map((u) => u.id);
    if (otherIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: otherIds } },
        data: { status: "SUSPENDED" },
      });
    }

    try {
      const blockSuspendSelfOnly = await updateUserAsAdmin({
        actorId: only.id,
        targetId: only.id,
        status: "SUSPENDED",
      });
      expect(blockSuspendSelfOnly).toEqual({ error: "cannot_suspend_self" });

      const actor = await makeUser("actor-for-last", "USER");
      ids.push(actor.id);
      await prisma.user.update({
        where: { id: actor.id },
        data: { role: "ADMIN", status: "ACTIVE" },
      });
      await prisma.user.update({
        where: { id: actor.id },
        data: { status: "SUSPENDED" },
      });

      const blockByOther = await updateUserAsAdmin({
        actorId: actor.id,
        targetId: only.id,
        status: "SUSPENDED",
      });
      expect(blockByOther).toEqual({ error: "last_admin" });

      const blockDemoteLast = await updateUserAsAdmin({
        actorId: actor.id,
        targetId: only.id,
        role: "USER",
      });
      expect(blockDemoteLast).toEqual({ error: "last_admin" });
    } finally {
      if (otherIds.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: otherIds } },
          data: { status: "ACTIVE" },
        });
      }
    }
  });

  it("list users กรอง role + pagination", async () => {
    const admin = await makeUser("list-admin", "ADMIN");
    const u1 = await makeUser("list-user-a");
    const u2 = await makeUser("list-user-b");
    ids.push(admin.id, u1.id, u2.id);

    const admins = await listUsersForAdmin({
      role: "ADMIN",
      page: 1,
      limit: 10,
    });
    expect(admins.users.every((u) => u.role === "ADMIN")).toBe(true);
    expect(admins.roleCounts.ADMIN).toBeGreaterThanOrEqual(1);

    const usersPage = await listUsersForAdmin({
      role: "USER",
      page: 1,
      limit: 1,
    });
    expect(usersPage.limit).toBe(1);
    expect(usersPage.users).toHaveLength(1);
    expect(usersPage.users[0]?.role).toBe("USER");
    expect(usersPage.totalPages).toBeGreaterThanOrEqual(1);
  });
});
