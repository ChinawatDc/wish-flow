import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { jsonOk } from "@/lib/http";

/** สถานะความปลอดภัยของบัญชี — ใช้โดย AdminSecurityPinModal และหน้าโปรไฟล์ */
export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(
      {
        role: user.role,
        hasSecurityPin: user.hasSecurityPin,
        mustChangePassword: user.mustChangePassword,
        mustChangeSecurityPin: user.mustChangeSecurityPin,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
