import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { unpublishCardShare } from "@/lib/card-marketplace-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await unpublishCardShare({
      userId: user.id,
      eventId: id,
    });
    if ("error" in result) return jsonError("ไม่พบการแชร์นี้", 404);
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
