import { adminResetPassword } from "@/lib/account-security-service";
import { authErrorResponse, requireAdminStepUp } from "@/lib/auth-helpers";
import { getClientIp, jsonError, jsonOk } from "@/lib/http";
import { hashIp } from "@/lib/privacy-hash";

type Params = { params: Promise<{ id: string }> };

/** Admin reset password ของ user อื่น — ต้องผ่าน step-up; รหัสชั่วคราวโชว์ครั้งเดียว */
export async function POST(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminStepUp();
    const { id } = await params;

    const result = await adminResetPassword({
      actor: admin,
      targetId: id,
      ctx: { ipHash: hashIp(getClientIp(request)) },
    });
    if ("error" in result) {
      const map: Record<string, { msg: string; status: number }> = {
        self_reset_blocked: {
          msg: "ไม่สามารถรีเซ็ตรหัสผ่านตัวเองได้ — ใช้หน้าโปรไฟล์แทน",
          status: 400,
        },
        not_found: { msg: "ไม่พบผู้ใช้นี้", status: 404 },
      };
      const info = (result.error ? map[result.error] : undefined) ?? {
        msg: "ดำเนินการไม่สำเร็จ",
        status: 400,
      };
      return jsonError(info.msg, info.status);
    }

    return jsonOk(
      { ok: true, tempPassword: result.tempPassword },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
