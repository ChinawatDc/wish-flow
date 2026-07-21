import { z } from "zod";

import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { writeAudit } from "@/lib/audit-log";
import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

const schema = z.object({
  type: z.enum(["audit", "system"]),
  format: z.enum(["csv", "json"]).default("json"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

/** Export logs (Admin เท่านั้น) — ข้อมูลถูก sanitize ตั้งแต่ตอนเขียนแล้ว */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    const q = parsed.data;

    const dateFilter =
      q.from || q.to
        ? { occurredAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
        : {};

    const rows =
      q.type === "audit"
        ? await prisma.auditLog.findMany({
            where: dateFilter,
            orderBy: { occurredAt: "desc" },
            take: q.limit,
          })
        : await prisma.systemLog.findMany({
            where: dateFilter,
            orderBy: { occurredAt: "desc" },
            take: q.limit,
          });

    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_LOG_EXPORT,
      actor: { userId: admin.id, role: admin.role, email: admin.email },
      resourceType: "log",
      summaryTh: `ส่งออก ${q.type} log (${rows.length} รายการ)`,
      metadata: { type: q.type, format: q.format, count: rows.length },
    });

    const plain = rows.map((r) => ({ ...r })) as Record<string, unknown>[];
    if (q.format === "csv") {
      return new Response(toCsv(plain), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="wishflow-${q.type}-logs.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return new Response(JSON.stringify(plain, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="wishflow-${q.type}-logs.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
