import {
  authorizeGuestbookPhotoRead,
} from "@/lib/guestbook-service";
import { storage } from "@/lib/storage";

type Params = { params: Promise<{ id: string; entryId: string }> };

/** Public photo proxy — เฉพาะ entry ที่ APPROVED */
export async function GET(_request: Request, { params }: Params) {
  const { id, entryId } = await params;
  const authz = await authorizeGuestbookPhotoRead({
    eventId: id,
    entryId,
    viewerUserId: null,
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
      "Cache-Control": "private, max-age=300",
    },
  });
}
