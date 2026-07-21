import { cookies } from "next/headers";

import { UNLOCK_TTL_SECONDS, unlockCookieName } from "@/lib/constants";
import { getClientIp, jsonError, jsonOk } from "@/lib/http";
import { verifyEventPin } from "@/lib/event-service";
import { verifyPinSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ip = getClientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("ข้อมูลไม่ถูกต้อง", 400);
  }

  const parsed = verifyPinSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("PIN ต้องเป็นตัวเลข 6 หลัก", 400);
  }

  const result = await verifyEventPin({
    eventId: id,
    pin: parsed.data.pin,
    ipAddress: ip,
  });

  if (!result.ok) {
    if (result.status === 429) {
      return jsonError("ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่นะ", 429, {
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
    if (result.status === 410) return jsonError("อีเวนต์นี้หมดอายุแล้ว", 410);
    if (result.status === 404) return jsonError("ไม่พบอีเวนต์นี้", 404);
    return jsonError("PIN ไม่ถูกต้อง ลองใหม่อีกครั้ง", 401, {
      remaining: result.remaining,
      locked: result.remaining === 0,
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  const jar = await cookies();
  jar.set(unlockCookieName(id), result.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: UNLOCK_TTL_SECONDS,
  });

  return jsonOk({ ok: true, redirect: `/e/${id}/view` });
}
