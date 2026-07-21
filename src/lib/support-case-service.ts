import { randomBytes } from "crypto";
import type {
  SupportCasePriority,
  SupportCaseStatus,
  SupportMessageVisibility,
} from "@prisma/client";

import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { writeAudit } from "@/lib/audit-log";
import {
  SUPPORT_CONTACT_RATE_LIMIT,
  SUPPORT_CONTACT_RATE_WINDOW_MS,
  SUPPORT_MESSAGE_MAX_LENGTH,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/privacy-hash";
import { sanitizeText } from "@/lib/sanitize";

type AdminActor = { id: string; email: string; role: string };

const CASE_PUBLIC_SELECT = {
  id: true,
  caseNumber: true,
  status: true,
  priority: true,
  name: true,
  subject: true,
  detail: true,
  contactEmail: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Public (guest) side
// ---------------------------------------------------------------------------

export async function createContactCase(params: {
  name: string;
  subject: string;
  detail: string;
  contactEmail: string;
  usernameOrEmail?: string | null;
  phone?: string | null;
  ipHash?: string | null;
  deviceId?: string | null;
  userAgentDigest?: string | null;
}) {
  // rate limit ต่อ ipHash + deviceId (นับเคสในหน้าต่างเวลา)
  const since = new Date(Date.now() - SUPPORT_CONTACT_RATE_WINDOW_MS);
  const identityFilters = [];
  if (params.ipHash) identityFilters.push({ ipHash: params.ipHash });
  if (params.deviceId) identityFilters.push({ deviceId: params.deviceId });
  if (identityFilters.length > 0) {
    const recent = await prisma.supportCase.count({
      where: { createdAt: { gte: since }, OR: identityFilters },
    });
    if (recent >= SUPPORT_CONTACT_RATE_LIMIT) {
      return { error: "rate_limited" as const };
    }
  }

  // ผูกบัญชีอัตโนมัติถ้าอีเมลตรงกับ user ที่มีอยู่
  const emailToMatch = (params.usernameOrEmail || params.contactEmail)
    .trim()
    .toLowerCase();
  const linkedUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: emailToMatch }, { username: emailToMatch }],
    },
    select: { id: true },
  });

  // token สาธารณะ — เก็บเฉพาะ hash (sha256) ใน DB, โชว์ค่าจริงครั้งเดียว
  const accessToken = randomBytes(32).toString("base64url");

  const supportCase = await prisma.supportCase.create({
    data: {
      name: sanitizeText(params.name).slice(0, 120),
      subject: sanitizeText(params.subject).slice(0, 200),
      detail: sanitizeText(params.detail).slice(0, SUPPORT_MESSAGE_MAX_LENGTH),
      contactEmail: params.contactEmail.trim().toLowerCase().slice(0, 200),
      usernameOrEmail: params.usernameOrEmail?.trim().slice(0, 200) || null,
      phone: params.phone?.trim().slice(0, 30) || null,
      publicAccessTokenHash: hashToken(accessToken),
      ipHash: params.ipHash ?? null,
      deviceId: params.deviceId ?? null,
      userAgentDigest: params.userAgentDigest ?? null,
      linkedUserId: linkedUser?.id ?? null,
      statusHistory: { create: { toStatus: "NEW" } },
      messages: {
        create: {
          senderType: "GUEST",
          visibility: "PUBLIC",
          body: sanitizeText(params.detail).slice(0, SUPPORT_MESSAGE_MAX_LENGTH),
        },
      },
    },
    select: CASE_PUBLIC_SELECT,
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SUPPORT_CASE_CREATE,
    actor: null,
    resourceType: "support_case",
    resourceId: supportCase.id,
    summaryTh: `เปิดเคสติดต่อเจ้าหน้าที่ #${supportCase.caseNumber}`,
    ipHash: params.ipHash,
    deviceId: params.deviceId,
  });

  return { case: supportCase, accessToken };
}

/** เปิดดูเคสด้วย token เท่านั้น — IP อย่างเดียวเปิดไม่ได้ */
export async function getCaseByToken(params: { caseId: string; token: string }) {
  if (!params.token) return null;
  const supportCase = await prisma.supportCase.findUnique({
    where: { id: params.caseId },
    select: {
      ...CASE_PUBLIC_SELECT,
      publicAccessTokenHash: true,
      messages: {
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          senderType: true,
          body: true,
          createdAt: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
  });
  if (!supportCase) return null;
  if (supportCase.publicAccessTokenHash !== hashToken(params.token)) return null;

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- ตัด hash ออกจาก payload */
  const { publicAccessTokenHash: _hash, messages, ...rest } = supportCase;
  return {
    ...rest,
    // ฝั่ง public เห็นผู้ตอบเป็น "เจ้าหน้าที่" เสมอ
    messages: messages.map((m) => ({
      id: m.id,
      from: m.senderType === "GUEST" ? "คุณ" : "เจ้าหน้าที่",
      senderType: m.senderType,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function addGuestMessage(params: {
  caseId: string;
  token: string;
  body: string;
}) {
  const body = sanitizeText(params.body).trim().slice(0, SUPPORT_MESSAGE_MAX_LENGTH);
  if (!body) return { error: "empty" as const };

  const supportCase = await prisma.supportCase.findUnique({
    where: { id: params.caseId },
    select: { id: true, publicAccessTokenHash: true, status: true },
  });
  if (!supportCase || supportCase.publicAccessTokenHash !== hashToken(params.token)) {
    return { error: "not_found" as const };
  }
  if (supportCase.status === "CLOSED" || supportCase.status === "SPAM") {
    return { error: "closed" as const };
  }

  const message = await prisma.supportCaseMessage.create({
    data: {
      caseId: supportCase.id,
      senderType: "GUEST",
      visibility: "PUBLIC",
      body,
    },
  });
  // ผู้แจ้งตอบกลับแล้ว — ถ้าเคสรอผู้ใช้ให้ขยับกลับเข้าคิว
  if (supportCase.status === "WAITING_USER") {
    await prisma.supportCase.update({
      where: { id: supportCase.id },
      data: {
        status: "IN_PROGRESS",
        statusHistory: {
          create: { fromStatus: "WAITING_USER", toStatus: "IN_PROGRESS" },
        },
      },
    });
  } else {
    await prisma.supportCase.update({
      where: { id: supportCase.id },
      data: { updatedAt: new Date() },
    });
  }
  return { ok: true as const, messageId: message.id };
}

// ---------------------------------------------------------------------------
// Admin side
// ---------------------------------------------------------------------------

export async function listAdminCases(params: {
  status?: SupportCaseStatus;
  priority?: SupportCasePriority;
  assignedAdminId?: string;
  q?: string;
  page: number;
  limit: number;
}) {
  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(params.assignedAdminId ? { assignedAdminId: params.assignedAdminId } : {}),
    ...(params.q
      ? {
          OR: [
            { subject: { contains: params.q, mode: "insensitive" as const } },
            { name: { contains: params.q, mode: "insensitive" as const } },
            { contactEmail: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.supportCase.count({ where }),
    prisma.supportCase.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        priority: true,
        name: true,
        subject: true,
        contactEmail: true,
        createdAt: true,
        claimedAt: true,
        assignedAdmin: { select: { id: true, name: true, email: true } },
        linkedUser: { select: { id: true, email: true } },
      },
    }),
  ]);

  return {
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
    cases: rows.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      claimedAt: c.claimedAt?.toISOString() ?? null,
    })),
  };
}

export async function getAdminCase(caseId: string) {
  const c = await prisma.supportCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      caseNumber: true,
      status: true,
      priority: true,
      name: true,
      subject: true,
      detail: true,
      usernameOrEmail: true,
      contactEmail: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      claimedAt: true,
      closedAt: true,
      assignedAdmin: { select: { id: true, name: true, email: true } },
      linkedUser: { select: { id: true, email: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          senderType: true,
          visibility: true,
          body: true,
          createdAt: true,
          senderUserId: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: { fromStatus: true, toStatus: true, note: true, createdAt: true },
      },
    },
  });
  return c;
}

/** รับเคส — กันเคลมซ้ำด้วย updateMany เงื่อนไข assignedAdminId ยังว่าง */
export async function claimCase(params: { caseId: string; admin: AdminActor }) {
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.supportCase.updateMany({
      where: {
        id: params.caseId,
        assignedAdminId: null,
        status: { in: ["NEW", "IN_PROGRESS"] },
      },
      data: {
        assignedAdminId: params.admin.id,
        status: "CLAIMED",
        claimedAt: new Date(),
      },
    });
    if (updated.count === 0) return { claimed: false };
    await tx.supportCaseStatusHistory.create({
      data: {
        caseId: params.caseId,
        toStatus: "CLAIMED",
        changedByUserId: params.admin.id,
        note: "รับเคส",
      },
    });
    return { claimed: true };
  });

  if (!result.claimed) {
    const existing = await prisma.supportCase.findUnique({
      where: { id: params.caseId },
      select: { id: true },
    });
    if (!existing) return { error: "not_found" as const };
    return { error: "already_claimed" as const };
  }

  await writeAudit({
    action: AUDIT_ACTIONS.SUPPORT_CASE_CLAIM,
    actor: { userId: params.admin.id, role: params.admin.role, email: params.admin.email },
    resourceType: "support_case",
    resourceId: params.caseId,
    summaryTh: "รับเคสซัพพอร์ต",
  });
  return { ok: true as const };
}

export async function patchCase(params: {
  caseId: string;
  admin: AdminActor;
  status?: SupportCaseStatus;
  priority?: SupportCasePriority;
  assignedAdminId?: string | null;
  linkedUserId?: string | null;
}) {
  const existing = await prisma.supportCase.findUnique({
    where: { id: params.caseId },
    select: { id: true, status: true },
  });
  if (!existing) return { error: "not_found" as const };

  const statusChanged =
    params.status !== undefined && params.status !== existing.status;

  await prisma.supportCase.update({
    where: { id: params.caseId },
    data: {
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.priority !== undefined ? { priority: params.priority } : {}),
      ...(params.assignedAdminId !== undefined
        ? { assignedAdminId: params.assignedAdminId }
        : {}),
      ...(params.linkedUserId !== undefined
        ? { linkedUserId: params.linkedUserId }
        : {}),
      ...(params.status === "CLOSED" ? { closedAt: new Date() } : {}),
      ...(statusChanged
        ? {
            statusHistory: {
              create: {
                fromStatus: existing.status,
                toStatus: params.status!,
                changedByUserId: params.admin.id,
              },
            },
          }
        : {}),
    },
  });

  if (statusChanged) {
    await writeAudit({
      action:
        params.status === "CLOSED"
          ? AUDIT_ACTIONS.SUPPORT_CASE_CLOSE
          : AUDIT_ACTIONS.SUPPORT_CASE_STATUS_CHANGE,
      actor: { userId: params.admin.id, role: params.admin.role, email: params.admin.email },
      resourceType: "support_case",
      resourceId: params.caseId,
      summaryTh: `เปลี่ยนสถานะเคสเป็น ${params.status}`,
      metadata: { from: existing.status, to: params.status },
    });
  }
  if (params.assignedAdminId !== undefined) {
    await writeAudit({
      action: AUDIT_ACTIONS.SUPPORT_CASE_ASSIGN,
      actor: { userId: params.admin.id, role: params.admin.role, email: params.admin.email },
      resourceType: "support_case",
      resourceId: params.caseId,
      summaryTh: "มอบหมายผู้รับผิดชอบเคส",
      metadata: { assignedAdminId: params.assignedAdminId },
    });
  }
  return { ok: true as const };
}

export async function addAdminMessage(params: {
  caseId: string;
  admin: AdminActor;
  body: string;
  visibility: SupportMessageVisibility;
}) {
  const body = sanitizeText(params.body).trim().slice(0, SUPPORT_MESSAGE_MAX_LENGTH);
  if (!body) return { error: "empty" as const };

  const existing = await prisma.supportCase.findUnique({
    where: { id: params.caseId },
    select: { id: true, status: true },
  });
  if (!existing) return { error: "not_found" as const };

  const message = await prisma.supportCaseMessage.create({
    data: {
      caseId: params.caseId,
      senderType: "ADMIN",
      senderUserId: params.admin.id,
      visibility: params.visibility,
      body,
    },
  });

  // ตอบ public → เคสรอผู้ใช้ตอบกลับ
  if (
    params.visibility === "PUBLIC" &&
    ["NEW", "CLAIMED", "IN_PROGRESS"].includes(existing.status)
  ) {
    await prisma.supportCase.update({
      where: { id: params.caseId },
      data: {
        status: "WAITING_USER",
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: "WAITING_USER",
            changedByUserId: params.admin.id,
          },
        },
      },
    });
  }

  await writeAudit({
    action:
      params.visibility === "PUBLIC"
        ? AUDIT_ACTIONS.SUPPORT_CASE_REPLY_PUBLIC
        : AUDIT_ACTIONS.SUPPORT_CASE_NOTE_INTERNAL,
    actor: { userId: params.admin.id, role: params.admin.role, email: params.admin.email },
    resourceType: "support_case",
    resourceId: params.caseId,
    summaryTh:
      params.visibility === "PUBLIC" ? "ตอบกลับผู้แจ้งเคส" : "เพิ่มโน้ตภายในเคส",
    metadata: { messageId: message.id },
  });
  return { ok: true as const, messageId: message.id };
}
