import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import {
  listMessagesForAdmin,
  sendAdminMessage,
} from "@/lib/support-chat-service";

type Params = { params: Promise<{ id: string }> };

/** Admin — อ่านทุกข้อความรวม INTERNAL + ชื่อจริงของ admin */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await listMessagesForAdmin(id);
    if ("error" in result) return jsonError("ไม่พบห้องสนทนา", 404);
    return jsonOk(
      { user: result.user, messages: result.messages },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
  visibility: z.enum(["PUBLIC", "INTERNAL"]).default("PUBLIC"),
});

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
    if (!parsed.success) return jsonError("กรุณากรอกข้อความ", 400);

    const result = await sendAdminMessage({
      conversationId: id,
      admin,
      body: parsed.data.body,
      visibility: parsed.data.visibility,
    });
    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบห้องสนทนา", 404);
      return jsonError("กรุณากรอกข้อความ", 400);
    }
    return jsonOk({ ok: true, messageId: result.messageId }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
