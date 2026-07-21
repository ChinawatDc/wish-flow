import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { bulkModerateGuestbook } from "@/lib/guestbook-service";
import { jsonError, jsonOk } from "@/lib/http";
import { guestbookBulkSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = await request.json();
    const parsed = guestbookBulkSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("เลือกรายการไม่เกิน 50 รายการ", 400);
    }

    const result = await bulkModerateGuestbook({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      eventId: id,
      ids: parsed.data.ids,
      status: parsed.data.status,
    });

    if ("error" in result) {
      if (result.error === "bulk_limit") {
        return jsonError("เลือกรายการไม่เกิน 50 รายการ", 400);
      }
      if (result.error === "entry_not_found") {
        return jsonError("ไม่พบรายการที่เลือก", 404);
      }
      return jsonError("ไม่พบอีเวนต์นี้", 404);
    }

    return jsonOk(result);
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    return authErrorResponse(error);
  }
}
