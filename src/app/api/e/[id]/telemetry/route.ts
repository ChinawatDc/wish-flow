import { cookies } from "next/headers";

import { unlockCookieName } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import {
  recordTelemetry,
  telemetryIngestSchema,
} from "@/lib/telemetry-service";
import { verifyUnlockToken } from "@/lib/unlock-token";

type Params = { params: Promise<{ id: string }> };

/** Guest funnel telemetry — requires unlock token; server binds event + version */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(unlockCookieName(id))?.value;
  if (!token) return jsonError("กรุณากรอก PIN ก่อน", 401);
  const valid = await verifyUnlockToken(token, id);
  if (!valid) return jsonError("เซสชันหมดอายุ", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("ข้อมูลไม่ถูกต้อง", 400);
  }

  const parsed = telemetryIngestSchema.safeParse(body);
  if (!parsed.success) return jsonError("ข้อมูล telemetry ไม่ถูกต้อง", 400);

  const result = await recordTelemetry({
    eventId: id,
    kind: parsed.data.kind,
    stepKey: parsed.data.stepKey,
    stepType: parsed.data.stepType,
    stepIndex: parsed.data.stepIndex,
    deviceClass: parsed.data.deviceClass,
  });

  if ("error" in result) return jsonError("บันทึกไม่ได้", 400);
  return jsonOk({ ok: true });
}
