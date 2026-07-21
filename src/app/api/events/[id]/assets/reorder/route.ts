import { z } from "zod";

import { reorderAssets } from "@/lib/asset-service";
import { requireCreator } from "@/lib/device-token";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  orderedIds: z.array(z.string().uuid()).max(50),
});

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { deviceToken } = await requireCreator();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("ข้อมูลไม่ถูกต้อง", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

  const result = await reorderAssets({
    deviceToken,
    eventId: id,
    orderedIds: parsed.data.orderedIds,
  });
  if (!result.ok) return jsonError(result.reason, result.status);
  return jsonOk({ ok: true });
}
