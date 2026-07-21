import { storage, URL_PREFIX } from "@/lib/storage";

type Params = { params: Promise<{ path: string[] }> };

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_request: Request, { params }: Params) {
  const { path: segments } = await params;
  const url = `${URL_PREFIX}/${segments.join("/")}`;

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
