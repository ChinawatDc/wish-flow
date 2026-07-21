import { z } from "zod";

import { authErrorResponse, requireAdmin } from "@/lib/auth-helpers";
import { updateUserAsAdmin } from "@/lib/auth-service";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { events: true } },
      },
    });
    if (!user) return jsonError("ไม่พบผู้ใช้นี้", 404);

    return jsonOk({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      eventCount: user._count.events,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

const patchSchema = z
  .object({
    role: z.enum(["USER", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .refine((d) => d.role !== undefined || d.status !== undefined, {
    message: "ต้องระบุ role หรือ status",
  });

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

    const result = await updateUserAsAdmin({
      actorId: actor.id,
      targetId: id,
      role: parsed.data.role,
      status: parsed.data.status,
    });

    if ("error" in result) {
      const map: Record<string, { msg: string; status: number }> = {
        not_found: { msg: "ไม่พบผู้ใช้นี้", status: 404 },
        cannot_demote_self: {
          msg: "ไม่สามารถลดสิทธิ์ตัวเองได้",
          status: 400,
        },
        cannot_suspend_self: {
          msg: "ไม่สามารถระงับบัญชีตัวเองได้",
          status: 400,
        },
        last_admin: {
          msg: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน",
          status: 400,
        },
      };
      const info = (result.error ? map[result.error] : undefined) ?? { msg: "ดำเนินการไม่สำเร็จ", status: 400 };
      return jsonError(info.msg, info.status);
    }

    return jsonOk({ user: result.user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
