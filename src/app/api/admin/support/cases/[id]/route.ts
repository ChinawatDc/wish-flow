import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { getAdminCase, patchCase } from "@/lib/support-case-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const supportCase = await getAdminCase(id);
    if (!supportCase) return jsonError("ไม่พบเคสนี้", 404);
    return jsonOk({
      case: {
        ...supportCase,
        createdAt: supportCase.createdAt.toISOString(),
        updatedAt: supportCase.updatedAt.toISOString(),
        claimedAt: supportCase.claimedAt?.toISOString() ?? null,
        closedAt: supportCase.closedAt?.toISOString() ?? null,
        messages: supportCase.messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
        statusHistory: supportCase.statusHistory.map((h) => ({
          ...h,
          createdAt: h.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

const patchSchema = z
  .object({
    status: z
      .enum(["NEW", "CLAIMED", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED", "SPAM"])
      .optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    assignedAdminId: z.string().uuid().nullable().optional(),
    linkedUserId: z.string().uuid().nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "ไม่มีข้อมูลให้แก้ไข",
  });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

    const result = await patchCase({ caseId: id, admin, ...parsed.data });
    if ("error" in result) return jsonError("ไม่พบเคสนี้", 404);
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
