import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { listAdminInbox } from "@/lib/support-chat-service";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400);
    const result = await listAdminInbox(parsed.data);
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
