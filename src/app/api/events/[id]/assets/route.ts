import { listAssets, uploadAsset } from "@/lib/asset-service";
import { prisma } from "@/lib/db";
import { requireCreator } from "@/lib/device-token";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const event = await prisma.event.findFirst({
    where: { id, creatorId: creator.id },
    select: { id: true },
  });
  if (!event) return jsonError("ไม่พบอีเวนต์นี้", 404);

  return jsonOk({ assets: await listAssets(id) });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { deviceToken } = await requireCreator();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("ต้องส่งไฟล์แบบ multipart/form-data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("ไม่พบไฟล์รูป", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadAsset({
    deviceToken,
    eventId: id,
    buffer,
    declaredMime: file.type,
    originalName: file.name,
  });

  if (!result.ok) return jsonError(result.reason, result.status);
  return jsonOk({ asset: result.asset }, { status: 201 });
}
