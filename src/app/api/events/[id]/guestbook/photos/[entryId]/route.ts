import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { authorizeGuestbookPhotoRead } from "@/lib/guestbook-service";
import { storage } from "@/lib/storage";

type Params = { params: Promise<{ id: string; entryId: string }> };

/** Owner photo proxy — ดูได้ทุกสถานะของ entry ที่เป็นของตัวเอง */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id, entryId } = await params;
    const user = await requireUser();
    const authz = await authorizeGuestbookPhotoRead({
      eventId: id,
      entryId,
      viewerUserId: user.id,
    });
    if (!authz.ok) {
      return new Response(authz.status === 404 ? "Not found" : "Forbidden", {
        status: authz.status,
      });
    }

    const buffer = await storage.read(authz.photoUrl);
    if (!buffer) return new Response("Not found", { status: 404 });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": authz.mimeType ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
