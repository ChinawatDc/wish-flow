import { cookies } from "next/headers";

import { unlockCookieName, UNLOCK_TTL_SECONDS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { issueUnlockToken } from "@/lib/unlock-token";

type Params = { params: Promise<{ id: string }> };

/**
 * PUBLIC events: ออก unlock cookie โดยไม่ใช้ PIN เพื่อดูการ์ด
 * (guestbook เองไม่ต้องใช้ cookie นี้)
 */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      guestAccessMode: true,
    },
  });
  if (!event || event.status !== "active") {
    return jsonError("ไม่พบอีเวนต์นี้", 404);
  }
  if (event.expiresAt && event.expiresAt.getTime() < Date.now()) {
    return jsonError("อีเวนต์นี้หมดอายุแล้ว", 410);
  }
  if (event.guestAccessMode !== "PUBLIC") {
    return jsonError("อีเวนต์นี้ต้องใช้ PIN", 403);
  }

  const token = await issueUnlockToken(id);
  const jar = await cookies();
  jar.set(unlockCookieName(id), token, {
    httpOnly: true,
    sameSite: "lax",
    path: `/`,
    secure: process.env.NODE_ENV === "production",
    maxAge: UNLOCK_TTL_SECONDS,
  });

  return jsonOk({ ok: true, redirect: `/e/${id}/view` });
}
