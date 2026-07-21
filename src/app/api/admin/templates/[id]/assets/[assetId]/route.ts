import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { deleteTemplateAsset } from "@/lib/template-asset-service";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id, assetId } = await params;
    const result = await deleteTemplateAsset({ templateId: id, assetId });
    if (!result.ok) return jsonError("ไม่พบไฟล์", 404);
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
