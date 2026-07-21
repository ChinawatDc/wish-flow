import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { listGuestbookForOwner } from "@/lib/guestbook-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") ?? "ALL") as
      | "ALL"
      | "PENDING"
      | "APPROVED"
      | "HIDDEN"
      | "REJECTED";
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "20");

    const result = await listGuestbookForOwner({
      userId: user.id,
      eventId: id,
      status,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    if ("error" in result) return jsonError("ไม่พบอีเวนต์นี้", 404);
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
