import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import {
  adminTemplateQuerySchema,
  createTemplateDraft,
  listAdminTemplates,
} from "@/lib/template-studio-service";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = adminTemplateQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!parsed.success) return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400);
    const result = await listAdminTemplates(parsed.data);
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  mood: z.string().trim().max(30).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400, { details: parsed.error.flatten() });
    }
    const result = await createTemplateDraft({
      userId: user.id,
      ...parsed.data,
    });
    return jsonOk(
      {
        id: result.template.id,
        slug: result.template.slug,
        versionId: result.version.id,
        version: result.version.version,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    return authErrorResponse(error);
  }
}
