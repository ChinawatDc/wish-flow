import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { claimCase } from "@/lib/support-case-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const result = await claimCase({ caseId: id, admin });
    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบเคสนี้", 404);
      return jsonError("เคสนี้มีผู้รับแล้ว", 409);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
