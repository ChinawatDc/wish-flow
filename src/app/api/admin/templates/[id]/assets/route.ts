import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { getAdminTemplate } from "@/lib/template-studio-service";
import {
  listTemplateAssets,
  uploadTemplateAsset,
} from "@/lib/template-asset-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const template = await getAdminTemplate(id);
    if (!template) return jsonError("ไม่พบเทมเพลต", 404);
    const assets = await listTemplateAssets(template.id);
    return jsonOk({ assets });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const template = await getAdminTemplate(id);
    if (!template) return jsonError("ไม่พบเทมเพลต", 404);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("ต้องแนบไฟล์", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadTemplateAsset({
      templateId: template.id,
      buffer,
      declaredMime: file.type || "application/octet-stream",
      originalName: file.name || "upload.bin",
    });

    if (!result.ok) return jsonError(result.reason, result.status);
    return jsonOk(result.asset, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
