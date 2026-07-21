import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { listCardRevisions } from "@/lib/card-marketplace-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await listCardRevisions({
      userId: user.id,
      eventId: id,
    });
    if ("error" in result) return jsonError("ยังไม่ได้แชร์การ์ดนี้", 404);
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
