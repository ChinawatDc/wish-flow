import { z } from "zod";

import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { getProfile, updateProfile } from "@/lib/profile-service";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getProfile(user.id);
    if (!profile) return jsonError("ไม่พบข้อมูลผู้ใช้", 404);
    return jsonOk({ profile });
  } catch (error) {
    return authErrorResponse(error);
  }
}

const patchSchema = z
  .object({
    name: z.string().trim().max(120).nullable().optional(),
    username: z.string().trim().max(30).nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.username !== undefined || d.phone !== undefined,
    { message: "ไม่มีข้อมูลให้แก้ไข" },
  );

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

    const result = await updateProfile({ user, ...parsed.data });
    if ("error" in result) {
      const map: Record<string, string> = {
        invalid_username:
          "ชื่อผู้ใช้ต้องเป็น a-z, 0-9, _ . - ความยาว 3-30 ตัวอักษร",
        invalid_phone: "เบอร์โทรไม่ถูกต้อง",
        username_taken: "ชื่อผู้ใช้นี้ถูกใช้แล้ว",
      };
      return jsonError(
        (result.error ? map[result.error] : undefined) ?? "แก้ไขไม่สำเร็จ",
        400,
      );
    }
    return jsonOk({ profile: result.profile });
  } catch (error) {
    return authErrorResponse(error);
  }
}
