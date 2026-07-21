import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { duplicateTemplate } from "@/lib/template-studio-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const result = await duplicateTemplate({
      templateId: id,
      userId: user.id,
    });
    if ("error" in result) return jsonError("ไม่พบเทมเพลต", 404);
    return jsonOk(
      {
        id: result.template.id,
        slug: result.template.slug,
        versionId: result.version.id,
      },
      { status: 201 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
