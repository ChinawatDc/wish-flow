import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import {
  getAdminTemplate,
  getEditableDraft,
  updateDraftVersion,
} from "@/lib/template-studio-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const template = await getAdminTemplate(id);
    if (!template) return jsonError("ไม่พบเทมเพลต", 404);
    const draft = await getEditableDraft(template.id);
    return jsonOk({
      ...template,
      draft,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

const patchSchema = z.object({
  metadata: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(500).optional(),
      category: z.string().trim().max(40).optional(),
      tags: z.array(z.string().trim().max(40)).max(20).optional(),
      mood: z.string().trim().max(30).optional(),
      thumbnailUrl: z.string().trim().max(200).optional(),
      requiredAssetCount: z.number().int().min(0).max(24).optional(),
      isPremium: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(10000).optional(),
      marketplaceVisibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
      priceLabel: z.string().trim().max(40).nullable().optional(),
      priceCurrency: z.string().trim().max(8).nullable().optional(),
      licensingNotes: z.string().trim().max(1000).nullable().optional(),
    })
    .optional(),
  draft: z
    .object({
      stepsSchema: z.unknown().optional(),
      dataModel: z.unknown().optional(),
      settings: z.unknown().optional(),
      sampleData: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400, { details: parsed.error.flatten() });
    }

    const result = await updateDraftVersion({
      templateId: id,
      userId: user.id,
      metadata: parsed.data.metadata,
      draft: parsed.data.draft,
    });

    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบเทมเพลต", 404);
      if (result.error === "validation_failed") {
        return jsonError("ตรวจ schema ไม่ผ่าน", 400, {
          validation: result.validation,
        });
      }
      return jsonError("ไม่มี draft ให้แก้ไข", 400);
    }

    return jsonOk({
      template: result.template,
      version: result.version,
    });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    return authErrorResponse(error);
  }
}
