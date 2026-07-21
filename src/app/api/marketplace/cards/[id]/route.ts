import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { getMarketplaceCard } from "@/lib/card-marketplace-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await getMarketplaceCard({
      userId: user.id,
      listingId: id,
    });
    if ("error" in result) return jsonError("ไม่พบการ์ดนี้", 404);
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
