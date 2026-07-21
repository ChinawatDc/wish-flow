import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { getTemplateAnalytics } from "@/lib/telemetry-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await getTemplateAnalytics(id);
    if ("error" in result) return jsonError("ไม่พบเทมเพลต", 404);
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
