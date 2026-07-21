import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { publishTemplateVersion } from "@/lib/template-studio-service";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  releaseNotes: z.string().trim().min(1).max(2000),
  breakingChange: z.boolean().optional(),
  migrationNotes: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError("ต้องระบุ release notes", 400, {
        details: parsed.error.flatten(),
      });
    }

    const result = await publishTemplateVersion({
      templateId: id,
      userId: user.id,
      ...parsed.data,
    });

    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบเทมเพลต", 404);
      if (result.error === "no_draft") return jsonError("ไม่มี draft ให้ publish", 400);
      if (result.error === "release_notes_required") {
        return jsonError("ต้องระบุ release notes", 400);
      }
      if (result.error === "validation_failed") {
        return jsonError("ตรวจ QA ไม่ผ่าน — ยัง publish ไม่ได้", 400, {
          validation: result.validation,
        });
      }
      return jsonError("publish ไม่สำเร็จ", 400);
    }

    return jsonOk({
      templateId: result.template.id,
      version: result.version,
      validation: result.validation,
    });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    return authErrorResponse(error);
  }
}
