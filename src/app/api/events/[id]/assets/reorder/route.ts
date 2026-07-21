import { z } from "zod";

import { reorderAssets } from "@/lib/asset-service";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  orderedIds: z.array(z.string().uuid()).max(50),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

    const result = await reorderAssets({
      userId: user.id,
      eventId: id,
      orderedIds: parsed.data.orderedIds,
    });
    if (!result.ok) return jsonError(result.reason, result.status);
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
