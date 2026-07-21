import bcrypt from "bcryptjs";

import {
  SECURITY_PIN_LOCKOUT_MS,
  SECURITY_PIN_MAX_ATTEMPTS,
} from "@/lib/constants";
import { prisma } from "@/lib/db";

const SALT_ROUNDS = 12;

/** Security PIN ของบัญชี — ห้ามสับสนกับ Event PIN (`src/lib/pin.ts`) */
export function hashSecurityPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export function verifySecurityPinHash(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function isValidSecurityPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export type PinLockState =
  | { locked: false }
  | { locked: true; retryAfterSeconds: number };

export function checkPinLock(user: {
  securityPinLockedUntil: Date | null;
}): PinLockState {
  const until = user.securityPinLockedUntil;
  if (until && until.getTime() > Date.now()) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000)),
    };
  }
  return { locked: false };
}

/** นับครั้งผิด — ครบ SECURITY_PIN_MAX_ATTEMPTS แล้ว lock 15 นาที คืนค่า true ถ้าเพิ่ง lock */
export async function registerPinFailure(userId: string): Promise<{
  lockedNow: boolean;
  failedAttempts: number;
}> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { securityPinFailedAttempts: { increment: 1 } },
    select: { securityPinFailedAttempts: true },
  });
  if (user.securityPinFailedAttempts >= SECURITY_PIN_MAX_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        securityPinLockedUntil: new Date(Date.now() + SECURITY_PIN_LOCKOUT_MS),
        securityPinFailedAttempts: 0,
      },
    });
    return { lockedNow: true, failedAttempts: user.securityPinFailedAttempts };
  }
  return { lockedNow: false, failedAttempts: user.securityPinFailedAttempts };
}

export async function resetPinFailures(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { securityPinFailedAttempts: 0, securityPinLockedUntil: null },
  });
}
