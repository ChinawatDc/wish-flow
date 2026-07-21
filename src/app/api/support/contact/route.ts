import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { z } from "zod";

import { verifyCaptchaToken } from "@/lib/captcha";
import { SUPPORT_DEVICE_COOKIE } from "@/lib/constants";
import { getClientIp, jsonError, jsonOk } from "@/lib/http";
import { digestUa, hashIp } from "@/lib/privacy-hash";
import { createContactCase } from "@/lib/support-case-service";
import { writeSystemLog } from "@/lib/system-log";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(10).max(4000),
  contactEmail: z.string().trim().email().max(200),
  usernameOrEmail: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  captchaToken: z.string().max(2000).optional(),
});

/** Public — คนที่ login ไม่ได้ก็เปิดเคสได้ */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError("กรุณากรอกข้อมูลให้ครบถ้วน (รายละเอียดอย่างน้อย 10 ตัวอักษร)", 400);
    }

    const ip = getClientIp(request);
    const captcha = await verifyCaptchaToken(parsed.data.captchaToken, ip);
    if (!captcha.ok) {
      return jsonError("ยืนยัน CAPTCHA ไม่สำเร็จ กรุณาลองใหม่", 400);
    }

    // device cookie สำหรับ rate limit (ไม่ใช่ identity)
    const jar = await cookies();
    let deviceId = jar.get(SUPPORT_DEVICE_COOKIE)?.value;
    if (!deviceId || !/^[0-9a-f-]{36}$/.test(deviceId)) {
      deviceId = randomUUID();
      jar.set(SUPPORT_DEVICE_COOKIE, deviceId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    const result = await createContactCase({
      name: parsed.data.name,
      subject: parsed.data.subject,
      detail: parsed.data.detail,
      contactEmail: parsed.data.contactEmail,
      usernameOrEmail: parsed.data.usernameOrEmail || null,
      phone: parsed.data.phone || null,
      ipHash: hashIp(ip),
      deviceId,
      userAgentDigest: digestUa(request.headers.get("user-agent")),
    });

    if ("error" in result) {
      return jsonError("ส่งคำขอถี่เกินไป กรุณาลองใหม่ภายหลัง", 429);
    }

    // token โชว์ครั้งเดียว — no-store
    return jsonOk(
      {
        case: {
          id: result.case.id,
          caseNumber: result.case.caseNumber,
          subject: result.case.subject,
          status: result.case.status,
        },
        accessToken: result.accessToken,
        trackUrl: `/support/cases/${result.case.id}?token=${result.accessToken}`,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await writeSystemLog({
      level: "ERROR",
      source: "api",
      code: "SUPPORT_CONTACT_FAILED",
      message: "เปิดเคสติดต่อเจ้าหน้าที่ล้มเหลว",
      route: "/api/support/contact",
      error,
    });
    return jsonError("เกิดข้อผิดพลาด กรุณาลองใหม่", 500);
  }
}
