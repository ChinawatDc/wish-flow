import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import {
  deleteGuestbookEntry,
  moderateGuestbookEntry,
} from "@/lib/guestbook-service";
import { jsonError, jsonOk } from "@/lib/http";
import { guestbookModerateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, entryId } = await params;
    const user = await requireUser();
    const body = await request.json();
    const parsed = guestbookModerateSchema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

    const result = await moderateGuestbookEntry({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      eventId: id,
      entryId,
      status: parsed.data.status,
      rejectReason: parsed.data.rejectReason,
    });

    if ("error" in result) {
      if (result.error === "entry_not_found") {
        return jsonError("ไม่พบคำอวยพรนี้", 404);
      }
      return jsonError("ไม่พบอีเวนต์นี้", 404);
    }

    return jsonOk({
      id: result.entry.id,
      status: result.entry.status,
    });
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    return authErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, entryId } = await params;
    const user = await requireUser();
    const result = await deleteGuestbookEntry({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      eventId: id,
      entryId,
    });
    if ("error" in result) {
      if (result.error === "entry_not_found") {
        return jsonError("ไม่พบคำอวยพรนี้", 404);
      }
      return jsonError("ไม่พบอีเวนต์นี้", 404);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
