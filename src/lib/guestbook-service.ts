import { randomUUID } from "crypto";
import type { GuestbookEntryStatus, Prisma } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { writeAudit } from "@/lib/audit-log";
import {
  GUESTBOOK_BULK_MAX,
  GUESTBOOK_MESSAGE_MAX_LENGTH,
  GUESTBOOK_NAME_MAX_LENGTH,
  GUESTBOOK_RATE_LIMIT,
  GUESTBOOK_RATE_WINDOW_MS,
  GUESTBOOK_WALL_LIMIT_MAX,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/notification-adapter";
import { sanitizeText } from "@/lib/sanitize";
import { storage } from "@/lib/storage";
import { validateUpload } from "@/lib/upload-validation";

export type GuestbookPublicMeta = {
  eventId: string;
  name: string;
  guestbookEnabled: boolean;
  guestAccessMode: "PIN" | "PUBLIC";
  canSubmit: boolean;
  reason?: string;
};

function isExpired(expiresAt: Date | null | undefined) {
  return Boolean(expiresAt && expiresAt.getTime() < Date.now());
}

export async function getGuestbookPublicMeta(
  eventId: string,
): Promise<GuestbookPublicMeta | { error: "not_found" }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      status: true,
      expiresAt: true,
      guestbookEnabled: true,
      guestAccessMode: true,
    },
  });
  if (!event) return { error: "not_found" };

  if (event.status !== "active") {
    return {
      eventId: event.id,
      name: event.name,
      guestbookEnabled: event.guestbookEnabled,
      guestAccessMode: event.guestAccessMode,
      canSubmit: false,
      reason: "inactive",
    };
  }
  if (isExpired(event.expiresAt)) {
    return {
      eventId: event.id,
      name: event.name,
      guestbookEnabled: event.guestbookEnabled,
      guestAccessMode: event.guestAccessMode,
      canSubmit: false,
      reason: "expired",
    };
  }
  if (event.guestAccessMode !== "PUBLIC" || !event.guestbookEnabled) {
    return {
      eventId: event.id,
      name: event.name,
      guestbookEnabled: event.guestbookEnabled,
      guestAccessMode: event.guestAccessMode,
      canSubmit: false,
      reason: "disabled",
    };
  }

  return {
    eventId: event.id,
    name: event.name,
    guestbookEnabled: true,
    guestAccessMode: "PUBLIC",
    canSubmit: true,
  };
}

async function assertPublicSubmittable(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      status: true,
      expiresAt: true,
      guestbookEnabled: true,
      guestAccessMode: true,
      ownerUserId: true,
    },
  });
  if (!event) return { error: "not_found" as const };
  if (event.status !== "active") return { error: "inactive" as const };
  if (isExpired(event.expiresAt)) return { error: "expired" as const };
  if (event.guestAccessMode !== "PUBLIC" || !event.guestbookEnabled) {
    return { error: "disabled" as const };
  }
  return { event };
}

export async function submitGuestbookEntry(params: {
  eventId: string;
  displayName?: string | null;
  message: string;
  photo?: {
    buffer: Buffer;
    declaredMime: string;
    originalName: string;
  } | null;
  ipHash?: string | null;
  deviceId?: string | null;
  userAgentDigest?: string | null;
}) {
  const gate = await assertPublicSubmittable(params.eventId);
  if ("error" in gate) return gate;

  const since = new Date(Date.now() - GUESTBOOK_RATE_WINDOW_MS);
  const identityFilters: Prisma.GuestbookEntryWhereInput[] = [];
  if (params.ipHash) identityFilters.push({ ipHash: params.ipHash });
  if (params.deviceId) identityFilters.push({ deviceId: params.deviceId });
  if (identityFilters.length > 0) {
    const recent = await prisma.guestbookEntry.count({
      where: {
        eventId: params.eventId,
        createdAt: { gte: since },
        OR: identityFilters,
      },
    });
    if (recent >= GUESTBOOK_RATE_LIMIT) {
      return { error: "rate_limited" as const };
    }
  }

  const message = sanitizeText(params.message)
    .trim()
    .slice(0, GUESTBOOK_MESSAGE_MAX_LENGTH);
  if (!message) return { error: "invalid" as const };

  let displayName: string | null = null;
  if (params.displayName?.trim()) {
    displayName = sanitizeText(params.displayName)
      .trim()
      .slice(0, GUESTBOOK_NAME_MAX_LENGTH);
    if (!displayName) displayName = null;
  }

  let photoUrl: string | null = null;
  let photoMimeType: string | null = null;
  let photoSizeBytes: number | null = null;

  if (params.photo) {
    const validation = validateUpload({
      buffer: params.photo.buffer,
      declaredMime: params.photo.declaredMime,
      originalName: params.photo.originalName,
    });
    if (!validation.ok) {
      return { error: "invalid_upload" as const, reason: validation.reason };
    }
    const filename = `${randomUUID()}.${validation.ext}`;
    photoUrl = await storage.save({
      guestbookEventId: params.eventId,
      filename,
      buffer: params.photo.buffer,
      contentType: validation.mime,
    });
    photoMimeType = validation.mime;
    photoSizeBytes = params.photo.buffer.length;
  }

  const entry = await prisma.guestbookEntry.create({
    data: {
      eventId: params.eventId,
      displayName,
      message,
      status: "PENDING",
      photoUrl,
      photoMimeType,
      photoSizeBytes,
      ipHash: params.ipHash ?? null,
      deviceId: params.deviceId ?? null,
      userAgentDigest: params.userAgentDigest ?? null,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.GUESTBOOK_SUBMIT,
    actor: null,
    resourceType: "guestbook_entry",
    resourceId: entry.id,
    summaryTh: "แขกส่งคำอวยพรเข้าสมุดอวยพร",
    ipHash: params.ipHash,
    deviceId: params.deviceId,
    metadata: {
      eventId: params.eventId,
      hasPhoto: Boolean(photoUrl),
      hasName: Boolean(displayName),
    },
  });

  if (gate.event.ownerUserId) {
    await notifyUser({
      userId: gate.event.ownerUserId,
      title: "มีคำอวยพรใหม่รออนุมัติ",
      body: `การ์ด “${gate.event.name}” มีข้อความใหม่ในสมุดอวยพร`,
      href: `/events/${params.eventId}/wishes`,
    });
  }

  return {
    entry: {
      id: entry.id,
      status: entry.status,
      createdAt: entry.createdAt.toISOString(),
    },
  };
}

export async function listApprovedWall(params: {
  eventId: string;
  cursor?: string | null;
  limit?: number;
}) {
  const gate = await assertPublicSubmittable(params.eventId);
  // wall เปิดได้เมื่อ guestbook เปิด + PUBLIC + active (แม้ submit ถูกปิดด้วยเหตุอื่นก็ไม่ควรโชว์)
  if ("error" in gate) {
    // allow wall read when enabled+PUBLIC but expired/inactive → empty with error upstream
    return { error: gate.error };
  }

  const limit = Math.min(
    Math.max(params.limit ?? 12, 1),
    GUESTBOOK_WALL_LIMIT_MAX,
  );

  const rows = await prisma.guestbookEntry.findMany({
    where: {
      eventId: params.eventId,
      status: "APPROVED",
      ...(params.cursor ? { createdAt: { lt: new Date(params.cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      displayName: true,
      message: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? page[page.length - 1]?.createdAt.toISOString() ?? null
    : null;

  return {
    entries: page.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      message: e.message,
      hasPhoto: Boolean(e.photoUrl),
      photoUrl: e.photoUrl
        ? `/api/e/${params.eventId}/guestbook/photos/${e.id}`
        : null,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

async function findOwnedEvent(userId: string, eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, ownerUserId: userId },
  });
}

export async function listGuestbookForOwner(params: {
  userId: string;
  eventId: string;
  status?: GuestbookEntryStatus | "ALL";
  page?: number;
  limit?: number;
}) {
  const event = await findOwnedEvent(params.userId, params.eventId);
  if (!event) return { error: "not_found" as const };

  const page = Math.max(params.page ?? 1, 1);
  const limit = [10, 20, 50].includes(params.limit ?? 20)
    ? (params.limit ?? 20)
    : 20;
  const statusFilter =
    params.status && params.status !== "ALL"
      ? { status: params.status }
      : {};

  const where = { eventId: params.eventId, ...statusFilter };

  const [total, counters, rows] = await Promise.all([
    prisma.guestbookEntry.count({ where }),
    prisma.guestbookEntry.groupBy({
      by: ["status"],
      where: { eventId: params.eventId },
      _count: true,
    }),
    prisma.guestbookEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const counts = {
    PENDING: 0,
    APPROVED: 0,
    HIDDEN: 0,
    REJECTED: 0,
    ALL: 0,
  };
  for (const c of counters) {
    counts[c.status] = c._count;
    counts.ALL += c._count;
  }

  return {
    event: {
      id: event.id,
      name: event.name,
      guestbookEnabled: event.guestbookEnabled,
      guestAccessMode: event.guestAccessMode,
    },
    counts,
    page,
    limit,
    total,
    entries: rows.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      message: e.message,
      status: e.status,
      hasPhoto: Boolean(e.photoUrl),
      photoUrl: e.photoUrl
        ? `/api/events/${params.eventId}/guestbook/photos/${e.id}`
        : null,
      rejectReason: e.rejectReason,
      moderatedAt: e.moderatedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

async function deleteGuestbookPhoto(photoUrl: string | null | undefined) {
  if (!photoUrl) return;
  await storage.delete(photoUrl);
}

export async function moderateGuestbookEntry(params: {
  userId: string;
  userEmail?: string | null;
  userRole?: string | null;
  eventId: string;
  entryId: string;
  status: "APPROVED" | "HIDDEN" | "REJECTED";
  rejectReason?: string | null;
}) {
  const event = await findOwnedEvent(params.userId, params.eventId);
  if (!event) return { error: "not_found" as const };

  const entry = await prisma.guestbookEntry.findFirst({
    where: { id: params.entryId, eventId: params.eventId },
  });
  if (!entry) return { error: "entry_not_found" as const };

  const rejectReason =
    params.status === "REJECTED" && params.rejectReason?.trim()
      ? sanitizeText(params.rejectReason).trim().slice(0, 200)
      : null;

  const updated = await prisma.guestbookEntry.update({
    where: { id: entry.id },
    data: {
      status: params.status,
      moderatedByUserId: params.userId,
      moderatedAt: new Date(),
      rejectReason,
    },
  });

  // reject → ลบรูปออกจาก storage เพื่อความเป็นส่วนตัว
  if (params.status === "REJECTED" && entry.photoUrl) {
    await deleteGuestbookPhoto(entry.photoUrl);
    await prisma.guestbookEntry.update({
      where: { id: entry.id },
      data: { photoUrl: null, photoMimeType: null, photoSizeBytes: null },
    });
  }

  const action =
    params.status === "APPROVED"
      ? AUDIT_ACTIONS.GUESTBOOK_APPROVE
      : params.status === "HIDDEN"
        ? AUDIT_ACTIONS.GUESTBOOK_HIDE
        : AUDIT_ACTIONS.GUESTBOOK_REJECT;

  await writeAudit({
    action,
    actor: {
      userId: params.userId,
      email: params.userEmail,
      role: params.userRole,
    },
    resourceType: "guestbook_entry",
    resourceId: entry.id,
    summaryTh: `เจ้าของ${params.status === "APPROVED" ? "อนุมัติ" : params.status === "HIDDEN" ? "ซ่อน" : "ปฏิเสธ"}คำอวยพร`,
    metadata: { eventId: params.eventId, status: params.status },
  });

  return { entry: updated };
}

export async function bulkModerateGuestbook(params: {
  userId: string;
  userEmail?: string | null;
  userRole?: string | null;
  eventId: string;
  ids: string[];
  status: "APPROVED" | "HIDDEN" | "REJECTED";
}) {
  if (params.ids.length === 0 || params.ids.length > GUESTBOOK_BULK_MAX) {
    return { error: "bulk_limit" as const };
  }

  const event = await findOwnedEvent(params.userId, params.eventId);
  if (!event) return { error: "not_found" as const };

  const entries = await prisma.guestbookEntry.findMany({
    where: { eventId: params.eventId, id: { in: params.ids } },
  });
  if (entries.length === 0) return { error: "entry_not_found" as const };

  await prisma.guestbookEntry.updateMany({
    where: { eventId: params.eventId, id: { in: entries.map((e) => e.id) } },
    data: {
      status: params.status,
      moderatedByUserId: params.userId,
      moderatedAt: new Date(),
      ...(params.status === "REJECTED" ? { rejectReason: null } : {}),
    },
  });

  if (params.status === "REJECTED") {
    for (const e of entries) {
      if (e.photoUrl) {
        await deleteGuestbookPhoto(e.photoUrl);
      }
    }
    await prisma.guestbookEntry.updateMany({
      where: {
        eventId: params.eventId,
        id: { in: entries.filter((e) => e.photoUrl).map((e) => e.id) },
      },
      data: { photoUrl: null, photoMimeType: null, photoSizeBytes: null },
    });
  }

  await writeAudit({
    action: AUDIT_ACTIONS.GUESTBOOK_BULK_MODERATE,
    actor: {
      userId: params.userId,
      email: params.userEmail,
      role: params.userRole,
    },
    resourceType: "event",
    resourceId: params.eventId,
    summaryTh: `เจ้าของจัดการคำอวยพรแบบกลุ่ม (${entries.length} รายการ → ${params.status})`,
    metadata: { count: entries.length, status: params.status },
  });

  return { updated: entries.length };
}

export async function deleteGuestbookEntry(params: {
  userId: string;
  userEmail?: string | null;
  userRole?: string | null;
  eventId: string;
  entryId: string;
}) {
  const event = await findOwnedEvent(params.userId, params.eventId);
  if (!event) return { error: "not_found" as const };

  const entry = await prisma.guestbookEntry.findFirst({
    where: { id: params.entryId, eventId: params.eventId },
  });
  if (!entry) return { error: "entry_not_found" as const };

  await deleteGuestbookPhoto(entry.photoUrl);
  await prisma.guestbookEntry.delete({ where: { id: entry.id } });

  await writeAudit({
    action: AUDIT_ACTIONS.GUESTBOOK_DELETE,
    actor: {
      userId: params.userId,
      email: params.userEmail,
      role: params.userRole,
    },
    resourceType: "guestbook_entry",
    resourceId: entry.id,
    summaryTh: "เจ้าของลบคำอวยพรออกจากสมุด",
    metadata: { eventId: params.eventId },
  });

  return { ok: true as const };
}

/** อ่านรูป guestbook — เจ้าของ หรือ entry ที่ APPROVED เท่านั้น */
export async function authorizeGuestbookPhotoRead(params: {
  eventId: string;
  entryId: string;
  viewerUserId?: string | null;
}): Promise<
  | { ok: true; photoUrl: string; mimeType: string | null }
  | { ok: false; status: 404 | 403 }
> {
  const entry = await prisma.guestbookEntry.findFirst({
    where: { id: params.entryId, eventId: params.eventId },
    select: {
      photoUrl: true,
      photoMimeType: true,
      status: true,
      event: { select: { ownerUserId: true } },
    },
  });
  if (!entry?.photoUrl) return { ok: false, status: 404 };

  const isOwner =
    params.viewerUserId &&
    entry.event.ownerUserId &&
    params.viewerUserId === entry.event.ownerUserId;
  const isApprovedPublic = entry.status === "APPROVED";

  if (!isOwner && !isApprovedPublic) {
    return { ok: false, status: 403 };
  }

  return {
    ok: true,
    photoUrl: entry.photoUrl,
    mimeType: entry.photoMimeType,
  };
}

export async function deleteAllGuestbookFiles(eventId: string) {
  const entries = await prisma.guestbookEntry.findMany({
    where: { eventId, photoUrl: { not: null } },
    select: { photoUrl: true },
  });
  await Promise.all(
    entries.map((e) => (e.photoUrl ? storage.delete(e.photoUrl) : Promise.resolve())),
  );
}
