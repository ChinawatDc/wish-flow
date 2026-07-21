import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["draft", "active", "archived", "expired"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Admin read-only: ดูการ์ดทุกบัญชี — ไม่มี pinHash */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400);

    const { q, status, page, limit } = parsed.data;
    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { owner: { email: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          viewCount: true,
          eventDate: true,
          createdAt: true,
          claimedAt: true,
          owner: { select: { id: true, email: true, name: true } },
          template: { select: { id: true, slug: true, name: true } },
        },
      }),
    ]);

    return jsonOk({
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      events: rows.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        viewCount: e.viewCount,
        eventDate: e.eventDate?.toISOString().slice(0, 10) ?? null,
        createdAt: e.createdAt.toISOString(),
        claimedAt: e.claimedAt?.toISOString() ?? null,
        owner: e.owner,
        template: e.template,
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
