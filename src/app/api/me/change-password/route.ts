import { z } from "zod";

import { changePassword } from "@/lib/account-security-service";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { getClientIp, jsonError, jsonOk } from "@/lib/http";
import { hashIp } from "@/lib/privacy-hash";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร", 400);
    }

    const result = await changePassword({
      user,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      ctx: { ipHash: hashIp(getClientIp(request)) },
    });
    if ("error" in result) {
      const map: Record<string, { msg: string; status: number }> = {
        weak_password: {
          msg: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร",
          status: 400,
        },
        no_password: {
          msg: "บัญชีนี้ยังไม่มีรหัสผ่าน กรุณาใช้เมนูตั้งรหัสผ่าน",
          status: 400,
        },
        wrong_password: { msg: "รหัสผ่านปัจจุบันไม่ถูกต้อง", status: 400 },
        not_found: { msg: "ไม่พบข้อมูลผู้ใช้", status: 404 },
      };
      const info = (result.error ? map[result.error] : undefined) ?? {
        msg: "ดำเนินการไม่สำเร็จ",
        status: 400,
      };
      return jsonError(info.msg, info.status);
    }
    // authVersion ถูก bump — client ต้อง login ใหม่
    return jsonOk({ ok: true, reloginRequired: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
