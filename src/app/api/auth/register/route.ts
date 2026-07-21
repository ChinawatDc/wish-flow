import { z } from "zod";

import { registerUser } from "@/lib/auth-service";
import { jsonError, jsonOk } from "@/lib/http";

const registerSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(100),
  name: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("ข้อมูลไม่ถูกต้อง", 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("อีเมลไม่ถูกต้อง หรือรหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", 400);
  }

  const result = await registerUser(parsed.data);
  if ("error" in result) {
    return jsonError("อีเมลนี้ถูกใช้แล้ว", 409);
  }

  return jsonOk({ user: result.user }, { status: 201 });
}
