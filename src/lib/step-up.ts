import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { STEP_UP_COOKIE, STEP_UP_TTL_SECONDS } from "@/lib/constants";

function getSecret() {
  const secret = process.env.UNLOCK_JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("UNLOCK_JWT_SECRET / AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

/** ออก step-up token (5 นาที) หลัง admin ยืนยัน Security PIN สำเร็จ */
export async function createStepUpToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: "admin-step-up" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STEP_UP_TTL_SECONDS}s`)
    .sign(getSecret());
}

export function stepUpCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: STEP_UP_TTL_SECONDS,
  };
}

export async function verifyStepUpToken(
  token: string,
  expectedUserId: string,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sub === expectedUserId && payload.purpose === "admin-step-up";
  } catch {
    return false;
  }
}

/** อ่าน step-up cookie จาก request ปัจจุบัน แล้วตรวจว่าเป็นของ admin คนนี้ */
export async function hasValidStepUp(userId: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(STEP_UP_COOKIE)?.value;
  if (!token) return false;
  return verifyStepUpToken(token, userId);
}
