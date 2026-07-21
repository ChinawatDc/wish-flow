import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { generateSixDigitPin } from "@/lib/device-token";
import { hashPin, verifyPin } from "@/lib/pin";
import { checkPinRateLimit, logPinAttempt } from "@/lib/rate-limit";
import { issueUnlockToken } from "@/lib/unlock-token";

export async function createEvent(params: {
  userId: string;
  name: string;
  pin?: string;
}) {
  const pin = params.pin ?? generateSixDigitPin();
  const pinHash = await hashPin(pin);

  const defaultTemplate = await prisma.template.findFirst({
    where: { isActive: true, slug: "hbd-classic" },
    include: { currentPublishedVersion: true },
  });

  const event = await prisma.event.create({
    data: {
      name: params.name,
      ownerUserId: params.userId,
      claimedAt: new Date(),
      pinHash,
      templateId: defaultTemplate?.id,
      templateVersionId: defaultTemplate?.currentPublishedVersionId ?? null,
      templateData: {},
    },
  });

  return { event, pin };
}

export async function listEventsForUser(userId: string) {
  return prisma.event.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "desc" },
  });
}

async function findOwnedByUser(userId: string, eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, ownerUserId: userId },
  });
}

export async function updateOwnedEvent(params: {
  userId: string;
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
  const existing = await findOwnedByUser(params.userId, params.eventId);
  if (!existing) return { error: "not_found" as const };

  const { templateId, templateData, ...data } = params.data;

  let templateVersionId: string | null | undefined;
  if (templateId !== undefined) {
    if (templateId === null) {
      templateVersionId = null;
    } else {
      const template = await prisma.template.findFirst({
        where: {
          id: templateId,
          isActive: true,
          currentPublishedVersionId: { not: null },
        },
      });
      if (!template?.currentPublishedVersionId) {
        return { error: "template_unavailable" as const };
      }
      templateVersionId = template.currentPublishedVersionId;
      if (templateId !== existing.templateId) {
        await prisma.template.update({
          where: { id: templateId },
          data: { usageCount: { increment: 1 } },
        });
      }
    }
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
      ...(templateVersionId !== undefined
        ? {
            templateVersion:
              templateVersionId === null
                ? { disconnect: true }
                : { connect: { id: templateVersionId } },
          }
        : {}),
    },
  });
  return { event };
}

export async function deleteOwnedEvent(userId: string, eventId: string) {
  const existing = await findOwnedByUser(userId, eventId);
  if (!existing) return { error: "not_found" as const };

  await prisma.event.delete({ where: { id: eventId } });
  return { ok: true as const };
}

export async function regenerateOwnedPin(
  userId: string,
  eventId: string,
  customPin?: string,
) {
  const existing = await findOwnedByUser(userId, eventId);
  if (!existing) return { error: "not_found" as const };

  const pin = customPin ?? generateSixDigitPin();
  const pinHash = await hashPin(pin);
  await prisma.event.update({ where: { id: eventId }, data: { pinHash } });
  return { pin };
}

export async function duplicateOwnedEvent(userId: string, eventId: string) {
  const source = await findOwnedByUser(userId, eventId);
  if (!source) return { error: "not_found" as const };

  const pin = generateSixDigitPin();
  const pinHash = await hashPin(pin);

  const copy = await prisma.event.create({
    data: {
      name: `${source.name} (สำเนา)`,
      ownerUserId: userId,
      claimedAt: new Date(),
      templateId: source.templateId,
      templateVersionId: source.templateVersionId,
      templateData: source.templateData ?? {},
      eventDate: source.eventDate,
      expiresAt: source.expiresAt,
      pinHash,
      status: "draft",
      duplicatedFromEventId: source.id,
    },
  });

  const { cloneEventAssets } = await import("@/lib/card-marketplace-service");
  await cloneEventAssets({
    sourceEventId: source.id,
    targetEventId: copy.id,
  });

  return { event: copy, pin };
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
