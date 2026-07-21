import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { writeAudit } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import {
  checkPinLock,
  hashSecurityPin,
  isValidSecurityPin,
  registerPinFailure,
  resetPinFailures,
  verifySecurityPinHash,
} from "@/lib/security-pin";

const PASSWORD_SALT_ROUNDS = 12;

type ActorContext = {
  ipHash?: string | null;
  deviceId?: string | null;
};

function actorOf(user: { id: string; email: string; role: string }) {
  return { userId: user.id, role: user.role, email: user.email };
}

/** สุ่มรหัสผ่านชั่วคราว (โชว์ครั้งเดียว) — crypto.randomBytes */
export function generateTempPassword(): string {
  return `Wf${randomBytes(9).toString("base64url")}`;
}

/** สุ่ม Security PIN ชั่วคราว 6 หลักจาก randomBytes */
export function generateTempPin(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

// ---------------------------------------------------------------------------
// Security PIN (บัญชี — คนละอย่างกับ Event PIN)
// ---------------------------------------------------------------------------

export async function setSecurityPin(params: {
  user: { id: string; email: string; role: string };
  pin: string;
  ctx?: ActorContext;
}) {
  if (!isValidSecurityPin(params.pin)) {
    return { error: "invalid_pin" as const };
  }
  const db = await prisma.user.findUnique({
    where: { id: params.user.id },
    select: { securityPinHash: true },
  });
  if (!db) return { error: "not_found" as const };
  if (db.securityPinHash) return { error: "already_set" as const };

  const hash = await hashSecurityPin(params.pin);
  await prisma.user.update({
    where: { id: params.user.id },
    data: {
      securityPinHash: hash,
      securityPinSetAt: new Date(),
      securityPinFailedAttempts: 0,
      securityPinLockedUntil: null,
      mustChangeSecurityPin: false,
    },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.USER_SECURITY_PIN_SET,
    actor: actorOf(params.user),
    resourceType: "user",
    resourceId: params.user.id,
    summaryTh: "ตั้ง Security PIN ของบัญชี",
    ipHash: params.ctx?.ipHash,
    deviceId: params.ctx?.deviceId,
  });
  return { ok: true as const };
}

export async function changeSecurityPin(params: {
  user: { id: string; email: string; role: string };
  currentPin: string;
  newPin: string;
  ctx?: ActorContext;
}) {
  if (!isValidSecurityPin(params.newPin)) {
    return { error: "invalid_pin" as const };
  }
  const db = await prisma.user.findUnique({
    where: { id: params.user.id },
    select: { securityPinHash: true, securityPinLockedUntil: true },
  });
  if (!db?.securityPinHash) return { error: "no_pin" as const };

  const lock = checkPinLock(db);
  if (lock.locked) {
    return { error: "locked" as const, retryAfterSeconds: lock.retryAfterSeconds };
  }

  const ok = await verifySecurityPinHash(params.currentPin, db.securityPinHash);
  if (!ok) {
    const failure = await registerPinFailure(params.user.id);
    if (failure.lockedNow) {
      await writeAudit({
        action: AUDIT_ACTIONS.USER_SECURITY_PIN_LOCKOUT,
        actor: actorOf(params.user),
        resourceType: "user",
        resourceId: params.user.id,
        outcome: "FAILURE",
        summaryTh: "Security PIN ถูกล็อกชั่วคราว (กรอกผิดครบกำหนด)",
        ipHash: params.ctx?.ipHash,
      });
    }
    return { error: "wrong_pin" as const };
  }

  const hash = await hashSecurityPin(params.newPin);
  await prisma.user.update({
    where: { id: params.user.id },
    data: {
      securityPinHash: hash,
      securityPinSetAt: new Date(),
      securityPinFailedAttempts: 0,
      securityPinLockedUntil: null,
      mustChangeSecurityPin: false,
    },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.USER_SECURITY_PIN_CHANGE,
    actor: actorOf(params.user),
    resourceType: "user",
    resourceId: params.user.id,
    summaryTh: "เปลี่ยน Security PIN ของบัญชี",
    ipHash: params.ctx?.ipHash,
    deviceId: params.ctx?.deviceId,
  });
  return { ok: true as const };
}

/** ยืนยัน Security PIN สำหรับ step-up (มี lockout 5 ครั้ง / 15 นาที) */
export async function verifySecurityPinForStepUp(params: {
  user: { id: string; email: string; role: string };
  pin: string;
  ctx?: ActorContext;
}) {
  const db = await prisma.user.findUnique({
    where: { id: params.user.id },
    select: { securityPinHash: true, securityPinLockedUntil: true },
  });
  if (!db?.securityPinHash) return { error: "no_pin" as const };

  const lock = checkPinLock(db);
  if (lock.locked) {
    return { error: "locked" as const, retryAfterSeconds: lock.retryAfterSeconds };
  }

  const ok = await verifySecurityPinHash(params.pin, db.securityPinHash);
  if (!ok) {
    const failure = await registerPinFailure(params.user.id);
    await writeAudit({
      action: failure.lockedNow
        ? AUDIT_ACTIONS.USER_SECURITY_PIN_LOCKOUT
        : AUDIT_ACTIONS.ADMIN_STEP_UP_FAILURE,
      actor: actorOf(params.user),
      resourceType: "user",
      resourceId: params.user.id,
      outcome: "FAILURE",
      summaryTh: failure.lockedNow
        ? "Security PIN ถูกล็อกชั่วคราว (step-up ผิดครบกำหนด)"
        : "ยืนยัน Security PIN (step-up) ไม่สำเร็จ",
      ipHash: params.ctx?.ipHash,
    });
    return { error: "wrong_pin" as const, lockedNow: failure.lockedNow };
  }

  await resetPinFailures(params.user.id);
  await writeAudit({
    action: AUDIT_ACTIONS.ADMIN_STEP_UP_SUCCESS,
    actor: actorOf(params.user),
    resourceType: "user",
    resourceId: params.user.id,
    summaryTh: "ยืนยัน Security PIN (step-up) สำเร็จ",
    ipHash: params.ctx?.ipHash,
  });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

export async function changePassword(params: {
  user: { id: string; email: string; role: string };
  currentPassword: string;
  newPassword: string;
  ctx?: ActorContext;
}) {
  if (params.newPassword.length < 8) return { error: "weak_password" as const };
  const db = await prisma.user.findUnique({
    where: { id: params.user.id },
    select: { passwordHash: true },
  });
  if (!db) return { error: "not_found" as const };
  if (!db.passwordHash) return { error: "no_password" as const };

  const ok = await bcrypt.compare(params.currentPassword, db.passwordHash);
  if (!ok) return { error: "wrong_password" as const };

  const passwordHash = await bcrypt.hash(params.newPassword, PASSWORD_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: params.user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      authVersion: { increment: 1 },
    },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE,
    actor: actorOf(params.user),
    resourceType: "user",
    resourceId: params.user.id,
    summaryTh: "เปลี่ยนรหัสผ่านด้วยตนเอง",
    ipHash: params.ctx?.ipHash,
    deviceId: params.ctx?.deviceId,
  });
  return { ok: true as const };
}

/** สำหรับผู้ใช้ Google ที่ยังไม่มี passwordHash */
export async function setPassword(params: {
  user: { id: string; email: string; role: string };
  newPassword: string;
  ctx?: ActorContext;
}) {
  if (params.newPassword.length < 8) return { error: "weak_password" as const };
  const db = await prisma.user.findUnique({
    where: { id: params.user.id },
    select: { passwordHash: true },
  });
  if (!db) return { error: "not_found" as const };
  if (db.passwordHash) return { error: "already_has_password" as const };

  const passwordHash = await bcrypt.hash(params.newPassword, PASSWORD_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: params.user.id },
    data: { passwordHash, authVersion: { increment: 1 } },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.USER_PASSWORD_SET,
    actor: actorOf(params.user),
    resourceType: "user",
    resourceId: params.user.id,
    summaryTh: "ตั้งรหัสผ่านครั้งแรก (บัญชี OAuth)",
    ipHash: params.ctx?.ipHash,
  });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Admin reset (ต้องผ่าน step-up ก่อนถึงจะเรียกถึงชั้นนี้)
// ---------------------------------------------------------------------------

export async function adminResetPassword(params: {
  actor: { id: string; email: string; role: string };
  targetId: string;
  ctx?: ActorContext;
}) {
  if (params.actor.id === params.targetId) {
    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_PASSWORD_RESET,
      actor: actorOf(params.actor),
      resourceType: "user",
      resourceId: params.targetId,
      outcome: "DENIED",
      summaryTh: "พยายามรีเซ็ตรหัสผ่านตัวเองผ่าน admin console (ถูกบล็อก)",
      ipHash: params.ctx?.ipHash,
    });
    return { error: "self_reset_blocked" as const };
  }
  const target = await prisma.user.findUnique({
    where: { id: params.targetId },
    select: { id: true, email: true },
  });
  if (!target) return { error: "not_found" as const };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, PASSWORD_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: params.targetId },
    data: {
      passwordHash,
      mustChangePassword: true,
      authVersion: { increment: 1 },
    },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.ADMIN_PASSWORD_RESET,
    actor: actorOf(params.actor),
    resourceType: "user",
    resourceId: params.targetId,
    summaryTh: `รีเซ็ตรหัสผ่านของ ${target.email}`,
    ipHash: params.ctx?.ipHash,
    metadata: { targetEmail: target.email },
  });
  // ห้ามเก็บ tempPassword ที่ไหนอีก — โชว์ครั้งเดียวใน response เท่านั้น
  return { ok: true as const, tempPassword };
}

export async function adminResetSecurityPin(params: {
  actor: { id: string; email: string; role: string };
  targetId: string;
  ctx?: ActorContext;
}) {
  if (params.actor.id === params.targetId) {
    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_SECURITY_PIN_RESET,
      actor: actorOf(params.actor),
      resourceType: "user",
      resourceId: params.targetId,
      outcome: "DENIED",
      summaryTh: "พยายามรีเซ็ต Security PIN ตัวเองผ่าน admin console (ถูกบล็อก)",
      ipHash: params.ctx?.ipHash,
    });
    return { error: "self_reset_blocked" as const };
  }
  const target = await prisma.user.findUnique({
    where: { id: params.targetId },
    select: { id: true, email: true },
  });
  if (!target) return { error: "not_found" as const };

  const tempPin = generateTempPin();
  const securityPinHash = await hashSecurityPin(tempPin);
  await prisma.user.update({
    where: { id: params.targetId },
    data: {
      securityPinHash,
      securityPinSetAt: new Date(),
      securityPinFailedAttempts: 0,
      securityPinLockedUntil: null,
      mustChangeSecurityPin: true,
      authVersion: { increment: 1 },
    },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.ADMIN_SECURITY_PIN_RESET,
    actor: actorOf(params.actor),
    resourceType: "user",
    resourceId: params.targetId,
    summaryTh: `รีเซ็ต Security PIN ของ ${target.email}`,
    ipHash: params.ctx?.ipHash,
    metadata: { targetEmail: target.email },
  });
  return { ok: true as const, tempPin };
}
