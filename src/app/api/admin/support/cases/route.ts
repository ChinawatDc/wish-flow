import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { listAdminCases } from "@/lib/support-case-service";

const querySchema = z.object({
  status: z
    .enum(["NEW", "CLAIMED", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED", "SPAM"])
    .optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignedAdminId: z.string().uuid().optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const raw = Object.fromEntries(
      [...url.searchParams.entries()].filter(([, v]) => v !== ""),
    );
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400);

    const result = await listAdminCases(parsed.data);
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
