import { isGuestbookUploadUrl, storage, URL_PREFIX } from "@/lib/storage";

type Params = { params: Promise<{ path: string[] }> };

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Serve event/template/revision uploads.
 * Guestbook photos ต้องผ่าน ACL proxy เท่านั้น — ห้ามอ่านตรงจาก path นี้
 */
export async function GET(_request: Request, { params }: Params) {
  const { path: segments } = await params;
  const url = `${URL_PREFIX}/${segments.join("/")}`;

  if (isGuestbookUploadUrl(url)) {
    return new Response("Forbidden", { status: 403 });
  }

  const buffer = await storage.read(url);
  if (!buffer) {
    return new Response("Not found", { status: 404 });
  }

  const ext = segments[segments.length - 1]?.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
