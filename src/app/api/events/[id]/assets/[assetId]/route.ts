import { deleteAsset } from "@/lib/asset-service";
import { requireCreator } from "@/lib/device-token";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id, assetId } = await params;
  const { deviceToken } = await requireCreator();

  const result = await deleteAsset({ deviceToken, eventId: id, assetId });
  if (!result.ok) return jsonError(result.reason, result.status);
  return jsonOk({ ok: true });
}
