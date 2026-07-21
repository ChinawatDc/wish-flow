import { z } from "zod";

import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { publishCardShare } from "@/lib/card-marketplace-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  blurb: z.string().trim().max(500).nullable().optional(),
  includeAssets: z.boolean().default(false),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

    const result = await publishCardShare({
      userId: user.id,
      eventId: id,
      title: parsed.data.title,
      blurb: parsed.data.blurb,
      includeAssets: parsed.data.includeAssets,
    });

    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบการ์ดนี้", 404);
      if (result.error === "no_template") {
        return jsonError("ต้องเลือกเทมเพลตก่อนแชร์", 400);
      }
      return jsonError("เผยแพร่ไม่สำเร็จ", 400);
    }

    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
