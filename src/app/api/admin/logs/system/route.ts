import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  level: z.enum(["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]).optional(),
  source: z.string().trim().max(40).optional(),
  code: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const raw = Object.fromEntries(
      [...url.searchParams.entries()].filter(([, v]) => v !== ""),
    );
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) return jsonError("พารามิเตอร์ไม่ถูกต้อง", 400);
    const q = parsed.data;

    const where = {
      ...(q.from || q.to
        ? { occurredAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
        : {}),
      ...(q.level ? { level: q.level } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(q.code ? { code: q.code } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.systemLog.count({ where }),
      prisma.systemLog.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);

    return jsonOk({
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      logs: rows.map((l) => ({
        ...l,
        occurredAt: l.occurredAt.toISOString(),
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
