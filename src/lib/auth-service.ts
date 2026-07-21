import bcrypt from "bcryptjs";

import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { writeAudit } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { hashPin } from "@/lib/pin";
import { generateSixDigitPin } from "@/lib/device-token";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerUser(params: {
  email: string;
  password: string;
  name?: string;
}) {
  const email = normalizeEmail(params.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "email_taken" as const };
  }

  const passwordHash = await bcrypt.hash(params.password, 12);
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isBootstrapAdmin = Boolean(adminEmail && email === adminEmail);

  const user = await prisma.user.create({
    data: {
      email,
      name: params.name?.trim() || null,
      passwordHash,
      role: isBootstrapAdmin ? "ADMIN" : "USER",
    },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  return { user };
}

/** ย้ายการ์ด anonymous ที่ยังไม่ claim จาก device_token เข้าบัญชีผู้ใช้ */
export async function claimDeviceEvents(params: {
  userId: string;
  deviceToken: string;
}) {
  const creator = await prisma.creator.findUnique({
    where: { deviceToken: params.deviceToken },
  });
  if (!creator) {
    return { claimed: 0, eventIds: [] as string[] };
  }

  const result = await prisma.$transaction(async (tx) => {
    const unclaimed = await tx.event.findMany({
      where: {
        creatorId: creator.id,
        ownerUserId: null,
      },
      select: { id: true },
    });
    if (unclaimed.length === 0) {
      return { claimed: 0, eventIds: [] as string[] };
    }

    const ids = unclaimed.map((e) => e.id);
    await tx.event.updateMany({
      where: { id: { in: ids }, ownerUserId: null },
      data: {
        ownerUserId: params.userId,
        claimedAt: new Date(),
      },
    });

    return { claimed: ids.length, eventIds: ids };
  });

  return result;
}

export async function listUsersForAdmin(params: {
  q?: string;
  role?: "USER" | "ADMIN";
  status?: "ACTIVE" | "SUSPENDED";
  page: number;
  limit: number;
}) {
  const where = {
    ...(params.role ? { role: params.role } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { email: { contains: params.q, mode: "insensitive" as const } },
            { name: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows, adminTotal, userTotal] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        securityPinHash: true,
        mustChangePassword: true,
        mustChangeSecurityPin: true,
        _count: { select: { events: true } },
      },
    }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "USER" } }),
  ]);

  return {
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
    roleCounts: { ADMIN: adminTotal, USER: userTotal },
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      eventCount: u._count.events,
      hasSecurityPin: Boolean(u.securityPinHash),
      mustChangePassword: u.mustChangePassword,
      mustChangeSecurityPin: u.mustChangeSecurityPin,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

export async function updateUserAsAdmin(params: {
  actorId: string;
  targetId: string;
  role?: "USER" | "ADMIN";
  status?: "ACTIVE" | "SUSPENDED";
}) {
  const target = await prisma.user.findUnique({ where: { id: params.targetId } });
  if (!target) return { error: "not_found" as const };

  if (params.role && params.role !== target.role) {
    if (params.targetId === params.actorId && params.role === "USER") {
      await writeAudit({
        action: AUDIT_ACTIONS.ADMIN_USER_ROLE_CHANGE,
        actor: { userId: params.actorId },
        resourceType: "user",
        resourceId: target.id,
        outcome: "DENIED",
        summaryTh: `ปฏิเสธการลดสิทธิ์ตัวเอง (${target.email})`,
        metadata: { reason: "cannot_demote_self", targetEmail: target.email },
      });
      return { error: "cannot_demote_self" as const };
    }
    if (target.role === "ADMIN" && params.role === "USER") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      });
      if (adminCount <= 1) {
        await writeAudit({
          action: AUDIT_ACTIONS.ADMIN_USER_ROLE_CHANGE,
          actor: { userId: params.actorId },
          resourceType: "user",
          resourceId: target.id,
          outcome: "DENIED",
          summaryTh: `ปฏิเสธการลดสิทธิ์ admin คนสุดท้าย (${target.email})`,
          metadata: { reason: "last_admin", targetEmail: target.email },
        });
        return { error: "last_admin" as const };
      }
    }
  }

  if (params.status === "SUSPENDED" && params.targetId === params.actorId) {
    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_USER_STATUS_CHANGE,
      actor: { userId: params.actorId },
      resourceType: "user",
      resourceId: target.id,
      outcome: "DENIED",
      summaryTh: `ปฏิเสธการระงับบัญชีตัวเอง (${target.email})`,
      metadata: { reason: "cannot_suspend_self", targetEmail: target.email },
    });
    return { error: "cannot_suspend_self" as const };
  }

  if (
    params.status === "SUSPENDED" &&
    target.role === "ADMIN" &&
    target.status === "ACTIVE"
  ) {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", status: "ACTIVE" },
    });
    if (adminCount <= 1) {
      await writeAudit({
        action: AUDIT_ACTIONS.ADMIN_USER_STATUS_CHANGE,
        actor: { userId: params.actorId },
        resourceType: "user",
        resourceId: target.id,
        outcome: "DENIED",
        summaryTh: `ปฏิเสธการระงับ admin คนสุดท้าย (${target.email})`,
        metadata: { reason: "last_admin", targetEmail: target.email },
      });
      return { error: "last_admin" as const };
    }
  }

  const user = await prisma.user.update({
    where: { id: params.targetId },
    data: {
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { events: true } },
    },
  });

  if (params.role && params.role !== target.role) {
    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_USER_ROLE_CHANGE,
      actor: { userId: params.actorId },
      resourceType: "user",
      resourceId: target.id,
      summaryTh: `เปลี่ยน role ของ ${target.email} เป็น ${params.role}`,
      metadata: { from: target.role, to: params.role, targetEmail: target.email },
    });
  }
  if (params.status && params.status !== target.status) {
    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_USER_STATUS_CHANGE,
      actor: { userId: params.actorId },
      resourceType: "user",
      resourceId: target.id,
      summaryTh: `เปลี่ยนสถานะของ ${target.email} เป็น ${params.status}`,
      metadata: { from: target.status, to: params.status, targetEmail: target.email },
    });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      eventCount: user._count.events,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export async function ensureBootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      return prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN" },
      });
    }
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash,
      role: "ADMIN",
    },
  });
}

/** helper สำหรับเทส — สร้าง event ของ user โดยตรง */
export async function createEventForUser(params: {
  userId: string;
  name: string;
  pin?: string;
}) {
  const pin = params.pin ?? generateSixDigitPin();
  const pinHash = await hashPin(pin);
  const defaultTemplate = await prisma.template.findFirst({
    where: { isActive: true, slug: "hbd-classic" },
  });
  const event = await prisma.event.create({
    data: {
      name: params.name,
      ownerUserId: params.userId,
      pinHash,
      templateId: defaultTemplate?.id,
      templateData: {},
      claimedAt: new Date(),
    },
  });
  return { event, pin };
}
