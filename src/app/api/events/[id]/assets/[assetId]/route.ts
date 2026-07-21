import { deleteAsset } from "@/lib/asset-service";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, assetId } = await params;
    const user = await requireUser();

    const result = await deleteAsset({
      userId: user.id,
      eventId: id,
      assetId,
    });
    if (!result.ok) return jsonError(result.reason, result.status);
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
