import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { listAssets } from "@/lib/asset-service";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/** Admin read-only detail — ไม่ส่ง pinHash */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true, name: true, role: true, status: true } },
        template: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            category: true,
          },
        },
      },
    });
    if (!event) return jsonError("ไม่พบอีเวนต์นี้", 404);

    const [assets, unlockStats] = await Promise.all([
      listAssets(id),
      prisma.eventAccessLog.groupBy({
        by: ["success"],
        where: { eventId: id },
        _count: true,
      }),
    ]);

    return jsonOk({
      id: event.id,
      name: event.name,
      status: event.status,
      viewCount: event.viewCount,
      eventDate: event.eventDate?.toISOString().slice(0, 10) ?? null,
      expiresAt: event.expiresAt?.toISOString().slice(0, 10) ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      claimedAt: event.claimedAt?.toISOString() ?? null,
      templateData: event.templateData,
      owner: event.owner,
      template: event.template,
      assets,
      stats: {
        unlockSuccess: unlockStats.find((s) => s.success)?._count ?? 0,
        unlockFail: unlockStats.find((s) => !s.success)?._count ?? 0,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
