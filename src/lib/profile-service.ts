import { Prisma } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { writeAudit } from "@/lib/audit-log";
import { prisma } from "@/lib/db";

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  username: true,
  phone: true,
  role: true,
  status: true,
  passwordHash: true,
  securityPinHash: true,
  mustChangePassword: true,
  mustChangeSecurityPin: true,
  createdAt: true,
} as const;

function toProfile(user: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  phone: string | null;
  role: string;
  status: string;
  passwordHash: string | null;
  securityPinHash: string | null;
  mustChangePassword: boolean;
  mustChangeSecurityPin: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    username: user.username,
    phone: user.phone,
    role: user.role,
    status: user.status,
    hasPassword: Boolean(user.passwordHash),
    hasSecurityPin: Boolean(user.securityPinHash),
    mustChangePassword: user.mustChangePassword,
    mustChangeSecurityPin: user.mustChangeSecurityPin,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  });
  return user ? toProfile(user) : null;
}

export async function updateProfile(params: {
  user: { id: string; email: string; role: string };
  name?: string | null;
  username?: string | null;
  phone?: string | null;
}) {
  const data: Prisma.UserUpdateInput = {};
  if (params.name !== undefined) data.name = params.name?.trim() || null;
  if (params.username !== undefined) {
    const username = params.username?.trim().toLowerCase() || null;
    if (username && !/^[a-z0-9_.-]{3,30}$/.test(username)) {
      return { error: "invalid_username" as const };
    }
    data.username = username;
  }
  if (params.phone !== undefined) {
    const phone = params.phone?.trim() || null;
    if (phone && !/^[0-9+\-() ]{6,20}$/.test(phone)) {
      return { error: "invalid_phone" as const };
    }
    data.phone = phone;
  }

  try {
    const user = await prisma.user.update({
      where: { id: params.user.id },
      data,
      select: PROFILE_SELECT,
    });
    await writeAudit({
      action: AUDIT_ACTIONS.USER_PROFILE_UPDATE,
      actor: { userId: params.user.id, role: params.user.role, email: params.user.email },
      resourceType: "user",
      resourceId: params.user.id,
      summaryTh: "แก้ไขข้อมูลโปรไฟล์",
      metadata: { fields: Object.keys(data) },
    });
    return { profile: toProfile(user) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "username_taken" as const };
    }
    throw error;
  }
}
