import { prisma } from "@/lib/db";
import { generateSixDigitPin, requireCreator } from "@/lib/device-token";
import { jsonError, jsonOk } from "@/lib/http";
import { hashPin } from "@/lib/pin";

type Params = { params: Promise<{ id: string }> };

/** ทำสำเนา event (ไม่ก๊อปรูป/สถิติ) พร้อม PIN ใหม่ */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const { creator } = await requireCreator();

  const source = await prisma.event.findFirst({
    where: { id, creatorId: creator.id },
  });
  if (!source) return jsonError("ไม่พบอีเวนต์นี้", 404);

  const pin = generateSixDigitPin();
  const pinHash = await hashPin(pin);

  const copy = await prisma.event.create({
    data: {
      name: `${source.name} (สำเนา)`,
      creatorId: creator.id,
      templateId: source.templateId,
      templateData: source.templateData ?? {},
      eventDate: source.eventDate,
      pinHash,
      status: "draft",
    },
  });

  return jsonOk({ id: copy.id, pin, name: copy.name }, { status: 201 });
}
