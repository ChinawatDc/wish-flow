import { createEvent } from "@/lib/event-service";
import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { createEventSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    const events = await prisma.event.findMany({
      where: { ownerUserId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { id: true, slug: true, name: true } },
      },
    });

    return jsonOk({
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        eventDate: e.eventDate?.toISOString().slice(0, 10) ?? null,
        status: e.status,
        viewCount: e.viewCount,
        template: e.template,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("กรุณากรอกชื่ออีเวนต์ และ PIN ต้องเป็นตัวเลข 6 หลัก", 400, {
        details: parsed.error.flatten(),
      });
    }

    const user = await requireUser();
    const { event, pin } = await createEvent({
      userId: user.id,
      name: parsed.data.name,
      pin: parsed.data.pin,
    });

    return jsonOk({ id: event.id, pin, name: event.name }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("ข้อมูลไม่ถูกต้อง", 400);
    }
    return authErrorResponse(error);
  }
}
