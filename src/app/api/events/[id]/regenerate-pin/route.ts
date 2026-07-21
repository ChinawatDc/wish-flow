import { regenerateOwnedPin } from "@/lib/event-service";
import { requireCreator } from "@/lib/device-token";
import { jsonError, jsonOk } from "@/lib/http";
import { changePinSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { deviceToken } = await requireCreator();

  let customPin: string | undefined;
  try {
    const body = await request.json();
    const parsed = changePinSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("PIN ต้องเป็นตัวเลข 6 หลัก", 400);
    }
    customPin = parsed.data.pin;
  } catch {
    // no body = random PIN
  }

  const result = await regenerateOwnedPin(deviceToken, id, customPin);
  if ("error" in result) {
    return jsonError(
      result.error === "not_found" ? "ไม่พบอีเวนต์นี้" : "ไม่มีสิทธิ์แก้ไขอีเวนต์นี้",
      result.error === "not_found" ? 404 : 401,
    );
  }
  return jsonOk({ id, pin: result.pin });
}
