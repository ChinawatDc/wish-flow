import { z } from "zod";

import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));

    const [notifications, unreadCount] = await Promise.all([
      prisma.appNotification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true },
      }),
      prisma.appNotification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return jsonOk({
      unreadCount,
      notifications: notifications.map((n) => ({
        ...n,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

const patchSchema = z.object({ markAllRead: z.literal(true) });

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    if (!patchSchema.safeParse(body).success) {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    await prisma.appNotification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
