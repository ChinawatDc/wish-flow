import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { addAdminMessage } from "@/lib/support-case-service";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
  visibility: z.enum(["PUBLIC", "INTERNAL"]).default("PUBLIC"),
});

/** Admin ตอบผู้แจ้ง (PUBLIC) หรือโน้ตภายใน (INTERNAL) */
export async function POST(request: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

    const result = await addAdminMessage({
      caseId: id,
      admin,
      body: parsed.data.body,
      visibility: parsed.data.visibility,
    });
    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบเคสนี้", 404);
      return jsonError("กรุณากรอกข้อความ", 400);
    }
    return jsonOk({ ok: true, messageId: result.messageId }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
