import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { duplicateOwnedEvent } from "@/lib/event-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const result = await duplicateOwnedEvent(user.id, id);
    if ("error" in result) return jsonError("ไม่พบอีเวนต์นี้", 404);

    return jsonOk(
      { id: result.event.id, pin: result.pin, name: result.event.name },
      { status: 201 },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
