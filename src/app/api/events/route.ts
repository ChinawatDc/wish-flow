import { createEvent } from "@/lib/event-service";
import { jsonError, jsonOk } from "@/lib/http";
import { createEventSchema } from "@/lib/validation";
import { requireCreator } from "@/lib/device-token";
import { prisma } from "@/lib/db";

export async function GET() {
  const { creator } = await requireCreator();

  const events = await prisma.event.findMany({
    where: { creatorId: creator.id },
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

    const { deviceToken } = await requireCreator();
    const { event, pin } = await createEvent({
      deviceToken,
      name: parsed.data.name,
      pin: parsed.data.pin,
    });

    return jsonOk({ id: event.id, pin, name: event.name }, { status: 201 });
  } catch (error) {
    console.error(error);
    return jsonError("สร้างอีเวนต์ไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }
}
