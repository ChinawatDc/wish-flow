import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { generateSixDigitPin } from "@/lib/device-token";
import { hashPin, verifyPin } from "@/lib/pin";
import { checkPinRateLimit, logPinAttempt } from "@/lib/rate-limit";
import { issueUnlockToken } from "@/lib/unlock-token";

export async function ensureCreator(deviceToken: string) {
  return prisma.creator.upsert({
    where: { deviceToken },
    update: {},
    create: { deviceToken },
  });
}

export async function createEvent(params: {
  deviceToken: string;
  name: string;
  pin?: string;
}) {
  const creator = await ensureCreator(params.deviceToken);
  const pin = params.pin ?? generateSixDigitPin();
  const pinHash = await hashPin(pin);

  const defaultTemplate = await prisma.template.findFirst({
    where: { isActive: true, slug: "hbd-classic" },
  });

  const event = await prisma.event.create({
    data: {
      name: params.name,
      creatorId: creator.id,
      pinHash,
      templateId: defaultTemplate?.id,
      templateData: {},
    },
  });

  return { event, pin, creator };
}

export async function listEventsForDevice(deviceToken: string) {
  const creator = await prisma.creator.findUnique({ where: { deviceToken } });
  if (!creator) return [];
  return prisma.event.findMany({
    where: { creatorId: creator.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateOwnedEvent(params: {
  deviceToken: string;
  eventId: string;
  data: {
    name?: string;
    eventDate?: Date | null;
    expiresAt?: Date | null;
    status?: string;
    templateId?: string | null;
    templateData?: Record<string, unknown>;
  };
}) {
  const creator = await prisma.creator.findUnique({ where: { deviceToken: params.deviceToken } });
  if (!creator) return { error: "unauthorized" as const };

  const existing = await prisma.event.findFirst({
    where: { id: params.eventId, creatorId: creator.id },
  });
  if (!existing) return { error: "not_found" as const };

  const { templateId, templateData, ...data } = params.data;

  // นับสถิติการใช้เทมเพลตเมื่อเปลี่ยนเป็นอันใหม่
  if (templateId && templateId !== existing.templateId) {
    await prisma.template.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });
  }

  const event = await prisma.event.update({
    where: { id: params.eventId },
    data: {
      ...data,
      ...(templateData !== undefined
        ? { templateData: templateData as Prisma.InputJsonValue }
        : {}),
      ...(templateId !== undefined
        ? {
            template:
              templateId === null
                ? { disconnect: true }
                : { connect: { id: templateId } },
          }
        : {}),
    },
  });
  return { event };
}

export async function deleteOwnedEvent(deviceToken: string, eventId: string) {
  const creator = await prisma.creator.findUnique({ where: { deviceToken } });
  if (!creator) return { error: "unauthorized" as const };

  const existing = await prisma.event.findFirst({
    where: { id: eventId, creatorId: creator.id },
  });
  if (!existing) return { error: "not_found" as const };

  await prisma.event.delete({ where: { id: eventId } });
  return { ok: true as const };
}

export async function regenerateOwnedPin(
  deviceToken: string,
  eventId: string,
  customPin?: string,
) {
  const creator = await prisma.creator.findUnique({ where: { deviceToken } });
  if (!creator) return { error: "unauthorized" as const };

  const existing = await prisma.event.findFirst({
    where: { id: eventId, creatorId: creator.id },
  });
  if (!existing) return { error: "not_found" as const };

  const pin = customPin ?? generateSixDigitPin();
  const pinHash = await hashPin(pin);
  await prisma.event.update({ where: { id: eventId }, data: { pinHash } });
  return { pin };
}

export type VerifyPinResult =
  | { ok: true; token: string }
  | {
      ok: false;
      status: 404 | 410 | 429 | 401;
      retryAfterSeconds?: number;
      remaining?: number;
    };

export async function verifyEventPin(params: {
  eventId: string;
  pin: string;
  ipAddress: string | null;
}): Promise<VerifyPinResult> {
  const event = await prisma.event.findUnique({ where: { id: params.eventId } });
  if (!event || event.status !== "active") {
    return { ok: false, status: 404 };
  }
  if (event.expiresAt && event.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 410 };
  }

  const rate = await checkPinRateLimit(params.eventId, params.ipAddress);
  if (rate.limited) {
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  const matched = await verifyPin(params.pin, event.pinHash);
  await logPinAttempt({
    eventId: params.eventId,
    ipAddress: params.ipAddress,
    success: matched,
  });

  if (!matched) {
    const after = await checkPinRateLimit(params.eventId, params.ipAddress);
    return {
      ok: false,
      status: 401,
      remaining: after.limited ? 0 : after.remaining,
      retryAfterSeconds: after.limited ? after.retryAfterSeconds : undefined,
    };
  }

  const token = await issueUnlockToken(params.eventId);
  await prisma.event.update({
    where: { id: params.eventId },
    data: { viewCount: { increment: 1 } },
  });

  return { ok: true, token };
}
