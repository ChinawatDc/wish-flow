import { z } from "zod";

import { verifySecurityPinForStepUp } from "@/lib/account-security-service";
import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { STEP_UP_COOKIE, STEP_UP_TTL_SECONDS } from "@/lib/constants";
import { getClientIp, jsonError, jsonOk } from "@/lib/http";
import { hashIp } from "@/lib/privacy-hash";
import { createStepUpToken, stepUpCookieOptions } from "@/lib/step-up";

const schema = z.object({ pin: z.string().regex(/^\d{6}$/) });

/** ยืนยัน Security PIN ของ admin → ออก step-up cookie (5 นาที) */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("PIN ต้องเป็นตัวเลข 6 หลัก", 400);

    const result = await verifySecurityPinForStepUp({
      user: admin,
      pin: parsed.data.pin,
      ctx: { ipHash: hashIp(getClientIp(request)) },
    });
    if ("error" in result) {
      if (result.error === "locked") {
        return jsonError("PIN ถูกล็อกชั่วคราว กรุณาลองใหม่ภายหลัง", 429, {
          retryAfterSeconds: result.retryAfterSeconds,
        });
      }
      if (result.error === "no_pin") {
        return jsonError("ยังไม่ได้ตั้ง Security PIN", 400);
      }
      return jsonError("PIN ไม่ถูกต้อง", 401);
    }

    const token = await createStepUpToken(admin.id);
    const response = jsonOk(
      { ok: true, expiresInSeconds: STEP_UP_TTL_SECONDS },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(STEP_UP_COOKIE, token, stepUpCookieOptions());
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
