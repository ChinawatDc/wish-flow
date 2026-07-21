import { z } from "zod";

import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import {
  listMessagesForUser,
  sendUserMessage,
} from "@/lib/support-chat-service";

type Params = { params: Promise<{ id: string }> };

/** User — อ่านข้อความในห้องของตัวเอง (INTERNAL ถูกซ่อน, admin เป็น "เจ้าหน้าที่") */
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await listMessagesForUser({ conversationId: id, userId: user.id });
    if ("error" in result) return jsonError("ไม่พบห้องสนทนา", 404);
    return jsonOk({ messages: result.messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}

const schema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("กรุณากรอกข้อความ", 400);

    const result = await sendUserMessage({
      conversationId: id,
      user,
      body: parsed.data.body,
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
