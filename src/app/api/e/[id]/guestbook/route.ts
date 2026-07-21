import { getGuestbookPublicMeta } from "@/lib/guestbook-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/** Public meta — ตรวจว่าสมุดอวยพรเปิดและส่งได้หรือไม่ */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const meta = await getGuestbookPublicMeta(id);
  if ("error" in meta) return jsonError("ไม่พบอีเวนต์นี้", 404);
  return jsonOk(meta, { headers: { "Cache-Control": "no-store" } });
}
