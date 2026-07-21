import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { validateTemplateVersion } from "@/lib/template-studio-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    let versionId: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.versionId === "string") versionId = body.versionId;
    } catch {
      // empty body ok
    }
    const result = await validateTemplateVersion(id, versionId);
    if (result.error === "not_found") return jsonError("ไม่พบเทมเพลต", 404);
    return jsonOk(result.validation);
  } catch (error) {
    return authErrorResponse(error);
  }
}
