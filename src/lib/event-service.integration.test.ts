import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PIN_MAX_ATTEMPTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  createEvent,
  deleteOwnedEvent,
  listEventsForUser,
  regenerateOwnedPin,
  updateOwnedEvent,
  verifyEventPin,
} from "@/lib/event-service";
import { verifyUnlockToken } from "@/lib/unlock-token";

const hasDb = Boolean(process.env.DATABASE_URL);

async function makeUser(emailPrefix: string) {
  return prisma.user.create({
    data: {
      email: `${emailPrefix}-${randomUUID()}@test.local`,
      name: emailPrefix,
      passwordHash: "$2a$10$invalidhashforintegrationtestsxxxxxxxxxxxxxxxxx",
      role: "USER",
    },
  });
}

describe.runIf(hasDb)("event-service integration (Postgres + User ownership)", () => {
  let userId = "";
  let otherUserId = "";
  let eventId = "";
  let pin = "";

  beforeAll(async () => {
    const template = await prisma.template.findFirst({
      where: { slug: "hbd-classic" },
    });
    if (!template) throw new Error("Run npm run db:seed before integration tests");

    const user = await makeUser("owner");
    const other = await makeUser("other");
    userId = user.id;
    otherUserId = other.id;
  });

  afterAll(async () => {
    for (const id of [userId, otherUserId]) {
      if (!id) continue;
      await prisma.eventAccessLog.deleteMany({
        where: { event: { ownerUserId: id } },
      });
      await prisma.event.deleteMany({ where: { ownerUserId: id } });
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("creates event with hashed pin owned by user", async () => {
    const created = await createEvent({
      userId,
      name: "Integration Birthday",
    });
    eventId = created.event.id;
    pin = created.pin;

    expect(pin).toMatch(/^\d{6}$/);
    expect(created.event.pinHash).not.toBe(pin);
    expect(created.event.pinHash.startsWith("$2")).toBe(true);
    expect(created.event.ownerUserId).toBe(userId);
    expect(created.event.templateId).toBeTruthy();
  });

  it("creates event with a custom pin", async () => {
    const created = await createEvent({
      userId,
      name: "Custom PIN Event",
      pin: "424242",
    });
    expect(created.pin).toBe("424242");

    const ok = await verifyEventPin({
      eventId: created.event.id,
      pin: "424242",
      ipAddress: "10.9.9.9",
    });
    expect(ok.ok).toBe(true);
  });

  it("changes pin to a custom value", async () => {
    const created = await createEvent({ userId, name: "Change PIN Event" });
    const regen = await regenerateOwnedPin(userId, created.event.id, "777777");
    expect("pin" in regen && regen.pin === "777777").toBe(true);

    const ok = await verifyEventPin({
      eventId: created.event.id,
      pin: "777777",
      ipAddress: "10.9.9.10",
    });
    expect(ok.ok).toBe(true);
  });

  it("lists only owned events", async () => {
    const list = await listEventsForUser(userId);
    expect(list.some((e) => e.id === eventId)).toBe(true);
    const other = await listEventsForUser(otherUserId);
    expect(other.some((e) => e.id === eventId)).toBe(false);
  });

  it("updates owned event template data", async () => {
    const result = await updateOwnedEvent({
      userId,
      eventId,
      data: {
        name: "Updated Birthday",
        templateData: {
          title_text: "Surprise!",
          message_text: "Have a great day",
          sender_name: "Test",
          cake_style: "chocolate",
        },
      },
    });
    expect("event" in result).toBe(true);
    if (!("event" in result) || !result.event) return;
    expect(result.event.name).toBe("Updated Birthday");
  });

  it("rejects update from another user", async () => {
    const result = await updateOwnedEvent({
      userId: otherUserId,
      eventId,
      data: { name: "Hacked" },
    });
    expect(result).toEqual({ error: "not_found" });
  });

  it("verifies correct pin and issues unlock token", async () => {
    const result = await verifyEventPin({
      eventId,
      pin,
      ipAddress: "127.0.0.1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(await verifyUnlockToken(result.token, eventId)).toBe(true);
    }
  });

  it("rejects wrong pin", async () => {
    const wrong = pin === "000000" ? "111111" : "000000";
    const result = await verifyEventPin({
      eventId,
      pin: wrong,
      ipAddress: "10.0.0.2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rate-limits after too many failures", async () => {
    const fresh = await createEvent({ userId, name: "Rate Limit Target" });
    const ip = "203.0.113.50";

    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) {
      await verifyEventPin({
        eventId: fresh.event.id,
        pin: "999999",
        ipAddress: ip,
      });
    }

    const locked = await verifyEventPin({
      eventId: fresh.event.id,
      pin: fresh.pin,
      ipAddress: ip,
    });
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.status).toBe(429);
      expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("regenerates pin and invalidates old one", async () => {
    const target = await createEvent({ userId, name: "Regen PIN" });
    const oldPin = target.pin;
    const regen = await regenerateOwnedPin(userId, target.event.id);
    expect("pin" in regen).toBe(true);
    if (!("pin" in regen) || typeof regen.pin !== "string") return;
    const newPin = regen.pin;

    if (newPin !== oldPin) {
      const oldTry = await verifyEventPin({
        eventId: target.event.id,
        pin: oldPin,
        ipAddress: "10.0.0.9",
      });
      expect(oldTry.ok).toBe(false);
    }

    const newTry = await verifyEventPin({
      eventId: target.event.id,
      pin: newPin,
      ipAddress: "10.0.0.10",
    });
    expect(newTry.ok).toBe(true);
  });

  it("deletes owned event", async () => {
    const created = await createEvent({ userId, name: "To Delete" });
    const deleted = await deleteOwnedEvent(userId, created.event.id);
    expect(deleted).toEqual({ ok: true });
    const gone = await prisma.event.findUnique({ where: { id: created.event.id } });
    expect(gone).toBeNull();
  });
});
