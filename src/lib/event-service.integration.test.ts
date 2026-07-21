import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createEvent,
  deleteOwnedEvent,
  listEventsForDevice,
  regenerateOwnedPin,
  updateOwnedEvent,
  verifyEventPin,
} from "@/lib/event-service";
import { verifyUnlockToken } from "@/lib/unlock-token";
import { PIN_MAX_ATTEMPTS } from "@/lib/constants";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("event-service integration (Postgres)", () => {
  const deviceToken = `test-${randomUUID()}`;
  let eventId = "";
  let pin = "";

  beforeAll(async () => {
    // Ensure seed templates exist
    const template = await prisma.template.findFirst({
      where: { slug: "hbd-classic" },
    });
    if (!template) {
      throw new Error("Run npm run db:seed before integration tests");
    }
  });

  afterAll(async () => {
    const creator = await prisma.creator.findUnique({ where: { deviceToken } });
    if (creator) {
      await prisma.eventAccessLog.deleteMany({
        where: { event: { creatorId: creator.id } },
      });
      await prisma.event.deleteMany({ where: { creatorId: creator.id } });
      await prisma.creator.delete({ where: { id: creator.id } });
    }
    await prisma.$disconnect();
  });

  it("creates event with hashed pin (not plain text)", async () => {
    const created = await createEvent({
      deviceToken,
      name: "Integration Birthday",
    });
    eventId = created.event.id;
    pin = created.pin;

    expect(pin).toMatch(/^\d{6}$/);
    expect(created.event.pinHash).not.toBe(pin);
    expect(created.event.pinHash.startsWith("$2")).toBe(true);
    expect(created.event.templateId).toBeTruthy();
  });

  it("creates event with a custom pin chosen by creator", async () => {
    const created = await createEvent({
      deviceToken,
      name: "Custom PIN Event",
      pin: "424242",
    });
    expect(created.pin).toBe("424242");
    expect(created.event.pinHash).not.toBe("424242");

    const ok = await verifyEventPin({
      eventId: created.event.id,
      pin: "424242",
      ipAddress: "10.9.9.9",
    });
    expect(ok.ok).toBe(true);
  });

  it("changes pin to a custom value", async () => {
    const created = await createEvent({
      deviceToken,
      name: "Change PIN Event",
    });
    const regen = await regenerateOwnedPin(deviceToken, created.event.id, "777777");
    expect("pin" in regen && regen.pin === "777777").toBe(true);

    const ok = await verifyEventPin({
      eventId: created.event.id,
      pin: "777777",
      ipAddress: "10.9.9.10",
    });
    expect(ok.ok).toBe(true);
  });

  it("lists only owned events", async () => {
    const list = await listEventsForDevice(deviceToken);
    expect(list.some((e) => e.id === eventId)).toBe(true);

    const other = await listEventsForDevice(`other-${randomUUID()}`);
    expect(other).toHaveLength(0);
  });

  it("updates owned event template data", async () => {
    const result = await updateOwnedEvent({
      deviceToken,
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
    if ("event" in result) {
      expect(result.event.name).toBe("Updated Birthday");
    }
  });

  it("rejects update from another device", async () => {
    const result = await updateOwnedEvent({
      deviceToken: `intruder-${randomUUID()}`,
      eventId,
      data: { name: "Hacked" },
    });
    expect(result).toEqual({ error: "unauthorized" });
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

    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.viewCount).toBeGreaterThanOrEqual(1);
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
    const fresh = await createEvent({
      deviceToken,
      name: "Rate Limit Target",
    });
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
    const target = await createEvent({
      deviceToken,
      name: "Regen PIN",
    });
    const oldPin = target.pin;
    const regen = await regenerateOwnedPin(deviceToken, target.event.id);
    expect("pin" in regen).toBe(true);
    if (!("pin" in regen)) return;

    const oldTry = await verifyEventPin({
      eventId: target.event.id,
      pin: oldPin,
      ipAddress: "10.0.0.9",
    });
    // old pin may still succeed if randomly same — skip assert when equal
    if (regen.pin !== oldPin) {
      expect(oldTry.ok).toBe(false);
    }

    const newTry = await verifyEventPin({
      eventId: target.event.id,
      pin: regen.pin,
      ipAddress: "10.0.0.10",
    });
    expect(newTry.ok).toBe(true);
  });

  it("deletes owned event", async () => {
    const created = await createEvent({
      deviceToken,
      name: "To Delete",
    });
    const deleted = await deleteOwnedEvent(deviceToken, created.event.id);
    expect(deleted).toEqual({ ok: true });
    const gone = await prisma.event.findUnique({ where: { id: created.event.id } });
    expect(gone).toBeNull();
  });
});
