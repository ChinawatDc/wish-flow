import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { regenerateOwnedPin } from "@/lib/event-service";
import { jsonError, jsonOk } from "@/lib/http";
import { changePinSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();

    let customPin: string | undefined;
    try {
      const body = await request.json();
      const parsed = changePinSchema.safeParse(body);
      if (!parsed.success) return jsonError("PIN ต้องเป็นตัวเลข 6 หลัก", 400);
      customPin = parsed.data.pin;
    } catch {
      // no body = random PIN
    }

    const result = await regenerateOwnedPin(user.id, id, customPin);
    if ("error" in result) return jsonError("ไม่พบอีเวนต์นี้", 404);
    return jsonOk({ pin: result.pin });
  } catch (error) {
    return authErrorResponse(error);
  }
}
