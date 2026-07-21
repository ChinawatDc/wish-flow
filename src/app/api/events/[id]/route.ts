import {
  deleteOwnedEvent,
  updateOwnedEvent,
} from "@/lib/event-service";
import { deleteAllAssetFiles, listAssets } from "@/lib/asset-service";
import { prisma } from "@/lib/db";
import { requireCreator } from "@/lib/device-token";
import { jsonError, jsonOk } from "@/lib/http";
import { updateEventSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

async function getOwnedEvent(id: string, creatorId: string) {
  return prisma.event.findFirst({
    where: { id, creatorId },
    include: { template: true },
  });
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const event = await getOwnedEvent(id, creator.id);
  if (!event) return jsonError("ไม่พบอีเวนต์นี้", 404);

  const [assets, unlockStats] = await Promise.all([
    listAssets(id),
    prisma.eventAccessLog.groupBy({
      by: ["success"],
      where: { eventId: id },
      _count: true,
    }),
  ]);

  const unlockSuccess = unlockStats.find((s) => s.success)?._count ?? 0;
  const unlockFail = unlockStats.find((s) => !s.success)?._count ?? 0;

  return jsonOk({
    id: event.id,
    name: event.name,
    eventDate: event.eventDate?.toISOString().slice(0, 10) ?? null,
    templateId: event.templateId,
    templateData: event.templateData,
    status: event.status,
    viewCount: event.viewCount,
    expiresAt: event.expiresAt?.toISOString().slice(0, 10) ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    assets,
    stats: { unlockSuccess, unlockFail },
    template: event.template
      ? {
          id: event.template.id,
          slug: event.template.slug,
          name: event.template.name,
          description: event.template.description,
          thumbnailUrl: event.template.thumbnailUrl,
          category: event.template.category,
          stepsSchema: event.template.stepsSchema,
        }
      : null,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { deviceToken } = await requireCreator();

  try {
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400, { details: parsed.error.flatten() });
    }

    const data = parsed.data;

    if (data.templateId) {
      const template = await prisma.template.findFirst({
        where: { id: data.templateId, isActive: true },
      });
      if (!template) return jsonError("ไม่พบเทมเพลตนี้", 400);
    }

    const result = await updateOwnedEvent({
      deviceToken,
      eventId: id,
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.eventDate !== undefined
          ? {
              eventDate: data.eventDate
                ? new Date(`${data.eventDate}T00:00:00.000Z`)
                : null,
            }
          : {}),
        ...(data.expiresAt !== undefined
          ? {
              expiresAt: data.expiresAt
                ? new Date(`${data.expiresAt}T23:59:59.000Z`)
                : null,
            }
          : {}),
        ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
        ...(data.templateData !== undefined ? { templateData: data.templateData } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });

    if ("error" in result) {
      return jsonError(
        result.error === "not_found" ? "ไม่พบอีเวนต์นี้" : "ไม่มีสิทธิ์แก้ไขอีเวนต์นี้",
        result.error === "not_found" ? 404 : 401,
      );
    }

    return jsonOk({
      id: result.event.id,
      name: result.event.name,
      eventDate: result.event.eventDate?.toISOString().slice(0, 10) ?? null,
      templateId: result.event.templateId,
      templateData: result.event.templateData,
      status: result.event.status,
      viewCount: result.event.viewCount,
    });
  } catch (error) {
    console.error(error);
    return jsonError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { deviceToken } = await requireCreator();
  // ลบไฟล์รูปก่อน (DB rows หายด้วย cascade ตอนลบ event)
  const { creator } = await requireCreator();
  const owned = await prisma.event.findFirst({
    where: { id, creatorId: creator.id },
    select: { id: true },
  });
  if (owned) await deleteAllAssetFiles(id);

  const result = await deleteOwnedEvent(deviceToken, id);
  if ("error" in result) {
    return jsonError(
      result.error === "not_found" ? "ไม่พบอีเวนต์นี้" : "ไม่มีสิทธิ์ลบอีเวนต์นี้",
      result.error === "not_found" ? 404 : 401,
    );
  }
  return jsonOk({ ok: true });
}
