import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import {
  getAdminTemplate,
  listTemplateVersions,
} from "@/lib/template-studio-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const template = await getAdminTemplate(id);
    if (!template) return jsonError("ไม่พบเทมเพลต", 404);
    const versions = await listTemplateVersions(template.id);
    return jsonOk({
      templateId: template.id,
      currentPublishedVersionId: template.currentPublishedVersionId,
      versions,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
