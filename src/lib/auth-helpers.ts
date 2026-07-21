import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { hasValidStepUp } from "@/lib/step-up";
import type { UserRole, UserStatus } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: UserRole;
  status: UserStatus;
  authVersion: number;
  mustChangePassword: boolean;
  mustChangeSecurityPin: boolean;
  hasSecurityPin: boolean;
};

export class AuthError extends Error {
  constructor(
    public code: "unauthorized" | "forbidden" | "suspended" | "step_up_required",
    message: string,
  ) {
    super(message);
  }
}

/**
 * ต้องล็อกอินและบัญชี ACTIVE — re-check status + authVersion จาก DB
 * (JWT เก่าถูก invalidate เมื่อ authVersion bump หลังเปลี่ยน/รีเซ็ตรหัส)
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("unauthorized", "กรุณาเข้าสู่ระบบ");
  }

  const db = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      status: true,
      authVersion: true,
      mustChangePassword: true,
      mustChangeSecurityPin: true,
      securityPinHash: true,
    },
  });
  if (!db) {
    throw new AuthError("unauthorized", "กรุณาเข้าสู่ระบบ");
  }
  if (db.status === "SUSPENDED") {
    throw new AuthError("suspended", "บัญชีถูกระงับชั่วคราว");
  }

  const tokenAuthVersion = session.user.authVersion ?? 0;
  if (db.authVersion !== tokenAuthVersion) {
    throw new AuthError(
      "unauthorized",
      "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
    );
  }

  return {
    id: db.id,
    email: db.email,
    name: db.name,
    image: db.image,
    role: db.role,
    status: db.status,
    authVersion: db.authVersion,
    mustChangePassword: db.mustChangePassword,
    mustChangeSecurityPin: db.mustChangeSecurityPin,
    hasSecurityPin: Boolean(db.securityPinHash),
  };
}

/** ต้องเป็น ADMIN + ACTIVE — ไม่ใช่สิทธิ์แก้การ์ดของคนอื่น */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new AuthError("forbidden", "เฉพาะผู้ดูแลระบบเท่านั้น");
  }
  return user;
}

/** Admin + step-up token (ยืนยัน Security PIN ภายใน 5 นาที) สำหรับ action อ่อนไหว */
export async function requireAdminStepUp(): Promise<SessionUser> {
  const admin = await requireAdmin();
  const ok = await hasValidStepUp(admin.id);
  if (!ok) {
    throw new AuthError(
      "step_up_required",
      "กรุณายืนยัน Security PIN ก่อนดำเนินการ",
    );
  }
  return admin;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    const status =
      error.code === "unauthorized"
        ? 401
        : error.code === "step_up_required"
          ? 428
          : 403;
    return jsonError(error.message, status, {
      code: error.code,
    });
  }
  console.error(error);
  return jsonError("เกิดข้อผิดพลาด", 500);
}
