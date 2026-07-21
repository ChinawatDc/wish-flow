import { randomUUID } from "crypto";
import { cookies } from "next/headers";

import { verifyCaptchaToken } from "@/lib/captcha";
import { GUESTBOOK_DEVICE_COOKIE } from "@/lib/constants";
import { submitGuestbookEntry } from "@/lib/guestbook-service";
import { getClientIp, jsonError, jsonOk } from "@/lib/http";
import { digestUa, hashIp } from "@/lib/privacy-hash";
import { writeSystemLog } from "@/lib/system-log";
import { guestbookSubmitSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const form = await request.formData();

    const parsed = guestbookSubmitSchema.safeParse({
      displayName: form.get("displayName")?.toString() || null,
      message: form.get("message")?.toString() ?? "",
      captchaToken: form.get("captchaToken")?.toString() || null,
    });
    if (!parsed.success) {
      return jsonError("กรุณากรอกคำอวยพร (ไม่เกิน 1000 ตัวอักษร)", 400);
    }

    const ip = getClientIp(request);
    const captcha = await verifyCaptchaToken(parsed.data.captchaToken, ip);
    if (!captcha.ok) {
      return jsonError("ยืนยัน CAPTCHA ไม่สำเร็จ กรุณาลองใหม่", 400);
    }

    const jar = await cookies();
    let deviceId = jar.get(GUESTBOOK_DEVICE_COOKIE)?.value;
    if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
      deviceId = randomUUID();
      jar.set(GUESTBOOK_DEVICE_COOKIE, deviceId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    const photoFile = form.get("photo");
    let photo: {
      buffer: Buffer;
      declaredMime: string;
      originalName: string;
    } | null = null;

    if (photoFile && typeof photoFile !== "string") {
      const file = photoFile as File;
      if (file.size > 0) {
        const ab = await file.arrayBuffer();
        photo = {
          buffer: Buffer.from(ab),
          declaredMime: file.type || "application/octet-stream",
          originalName: file.name || "photo.jpg",
        };
      }
    }

    const result = await submitGuestbookEntry({
      eventId: id,
      displayName: parsed.data.displayName,
      message: parsed.data.message,
      photo,
      ipHash: hashIp(ip),
      deviceId,
      userAgentDigest: digestUa(request.headers.get("user-agent")),
    });

    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบอีเวนต์นี้", 404);
      if (result.error === "expired") return jsonError("อีเวนต์นี้หมดอายุแล้ว", 410);
      if (result.error === "inactive") {
        return jsonError("อีเวนต์นี้ยังไม่เปิดให้ส่งคำอวยพร", 403);
      }
      if (result.error === "disabled") {
        return jsonError("สมุดอวยพรยังไม่เปิดสาธารณะ", 403);
      }
      if (result.error === "rate_limited") {
        return jsonError("ส่งถี่เกินไป กรุณาลองใหม่ภายหลัง", 429);
      }
      if (result.error === "invalid_upload") {
        return jsonError(result.reason || "รูปไม่ถูกต้อง", 400);
      }
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }

    return jsonOk(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    await writeSystemLog({
      level: "ERROR",
      source: "api",
      code: "GUESTBOOK_SUBMIT_FAILED",
      message: "ส่งคำอวยพรล้มเหลว",
      route: "/api/e/[id]/guestbook/submit",
      error,
    });
    return jsonError("เกิดข้อผิดพลาด กรุณาลองใหม่", 500);
  }
}
