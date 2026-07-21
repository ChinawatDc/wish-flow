import { z } from "zod";

import { setPassword } from "@/lib/account-security-service";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { getClientIp, jsonError, jsonOk } from "@/lib/http";
import { hashIp } from "@/lib/privacy-hash";

const schema = z.object({
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
      return jsonError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร", 400);
    }

    const result = await setPassword({
      user,
      newPassword: parsed.data.newPassword,
      ctx: { ipHash: hashIp(getClientIp(request)) },
    });
    if ("error" in result) {
      const map: Record<string, string> = {
        weak_password: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร",
        already_has_password:
          "บัญชีนี้มีรหัสผ่านแล้ว กรุณาใช้เมนูเปลี่ยนรหัสผ่าน",
        not_found: "ไม่พบข้อมูลผู้ใช้",
      };
      return jsonError(
        (result.error ? map[result.error] : undefined) ?? "ดำเนินการไม่สำเร็จ",
        400,
      );
    }
    return jsonOk({ ok: true, reloginRequired: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
