import { listApprovedWall } from "@/lib/guestbook-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = Number(url.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 12;

  const result = await listApprovedWall({ eventId: id, cursor, limit });
  if ("error" in result) {
    if (result.error === "not_found") return jsonError("ไม่พบอีเวนต์นี้", 404);
    if (result.error === "expired") return jsonError("อีเวนต์นี้หมดอายุแล้ว", 410);
    return jsonError("ยังไม่เปิดสมุดอวยพรสาธารณะ", 403);
  }

  return jsonOk(result, { headers: { "Cache-Control": "no-store" } });
}
