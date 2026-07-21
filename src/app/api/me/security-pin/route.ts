import { z } from "zod";

import { changeSecurityPin, setSecurityPin } from "@/lib/account-security-service";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { getClientIp, jsonError, jsonOk } from "@/lib/http";
import { hashIp } from "@/lib/privacy-hash";

const setSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
  confirmPin: z.string().regex(/^\d{6}$/),
});

/** ตั้ง Security PIN ครั้งแรก */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = setSchema.safeParse(body);
    if (!parsed.success) return jsonError("PIN ต้องเป็นตัวเลข 6 หลัก", 400);
    if (parsed.data.pin !== parsed.data.confirmPin) {
      return jsonError("PIN ยืนยันไม่ตรงกัน", 400);
    }

    const result = await setSecurityPin({
      user,
      pin: parsed.data.pin,
      ctx: { ipHash: hashIp(getClientIp(request)) },
    });
    if ("error" in result) {
      const map: Record<string, string> = {
        invalid_pin: "PIN ต้องเป็นตัวเลข 6 หลัก",
        already_set: "ตั้ง PIN แล้ว กรุณาใช้เมนูเปลี่ยน PIN",
        not_found: "ไม่พบข้อมูลผู้ใช้",
      };
      return jsonError(
        (result.error ? map[result.error] : undefined) ?? "ดำเนินการไม่สำเร็จ",
        400,
      );
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

const changeSchema = z.object({
  currentPin: z.string().regex(/^\d{6}$/),
  newPin: z.string().regex(/^\d{6}$/),
  confirmPin: z.string().regex(/^\d{6}$/),
});

/** เปลี่ยน Security PIN (ต้องรู้ PIN เดิม, มี lockout) */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = changeSchema.safeParse(body);
    if (!parsed.success) return jsonError("PIN ต้องเป็นตัวเลข 6 หลัก", 400);
    if (parsed.data.newPin !== parsed.data.confirmPin) {
      return jsonError("PIN ยืนยันไม่ตรงกัน", 400);
    }

    const result = await changeSecurityPin({
      user,
      currentPin: parsed.data.currentPin,
      newPin: parsed.data.newPin,
      ctx: { ipHash: hashIp(getClientIp(request)) },
    });
    if ("error" in result) {
      if (result.error === "locked") {
        return jsonError("PIN ถูกล็อกชั่วคราว กรุณาลองใหม่ภายหลัง", 429, {
          retryAfterSeconds: result.retryAfterSeconds,
        });
      }
      const map: Record<string, string> = {
        invalid_pin: "PIN ต้องเป็นตัวเลข 6 หลัก",
        no_pin: "ยังไม่ได้ตั้ง PIN",
        wrong_pin: "PIN เดิมไม่ถูกต้อง",
      };
      return jsonError(
        (result.error ? map[result.error] : undefined) ?? "ดำเนินการไม่สำเร็จ",
        400,
      );
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
