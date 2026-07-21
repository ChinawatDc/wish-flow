import { randomInt, randomUUID } from "crypto";
import { cookies } from "next/headers";

import { DEVICE_TOKEN_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/db";

export function generateDeviceToken(): string {
  return randomUUID();
}

export function generateSixDigitPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Get or create creator from httpOnly device_token cookie. */
export async function requireCreator() {
  const jar = await cookies();
  let token = jar.get(DEVICE_TOKEN_COOKIE)?.value;

  if (!token) {
    token = generateDeviceToken();
    jar.set(DEVICE_TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  const creator = await prisma.creator.upsert({
    where: { deviceToken: token },
    update: {},
    create: { deviceToken: token },
  });

  return { creator, deviceToken: token };
}

export async function getCreatorOrNull() {
  const jar = await cookies();
  const token = jar.get(DEVICE_TOKEN_COOKIE)?.value;
  if (!token) return null;

  return prisma.creator.findUnique({ where: { deviceToken: token } });
}
