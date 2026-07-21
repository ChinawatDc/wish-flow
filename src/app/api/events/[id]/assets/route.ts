import { listAssets, uploadAsset } from "@/lib/asset-service";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const event = await prisma.event.findFirst({
      where: { id, ownerUserId: user.id },
      select: { id: true },
    });
    if (!event) return jsonError("ไม่พบอีเวนต์นี้", 404);

    return jsonOk({ assets: await listAssets(id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();

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
      userId: user.id,
      eventId: id,
      buffer,
      declaredMime: file.type,
      originalName: file.name,
    });

    if (!result.ok) return jsonError(result.reason, result.status);
    return jsonOk({ asset: result.asset }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
