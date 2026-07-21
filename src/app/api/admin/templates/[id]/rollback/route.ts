import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { rollbackToVersion } from "@/lib/template-studio-service";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  versionId: z.string().uuid(),
  releaseNotes: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

    const result = await rollbackToVersion({
      templateId: id,
      userId: user.id,
      versionId: parsed.data.versionId,
      releaseNotes: parsed.data.releaseNotes,
    });

    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบเวอร์ชัน", 404);
      if (result.error === "validation_failed") {
        return jsonError("rollback ไม่ผ่าน validation", 400, {
          validation: result.validation,
        });
      }
      return jsonError("rollback ไม่สำเร็จ", 400);
    }

    return jsonOk({
      templateId: result.template.id,
      version: result.version,
    });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    return authErrorResponse(error);
  }
}
