import QRCode from "qrcode";

import { requireCreator } from "@/lib/device-token";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const { creator } = await requireCreator();

  const event = await prisma.event.findFirst({
    where: { id, creatorId: creator.id },
    select: { id: true, name: true },
  });
  if (!event) return jsonError("ไม่พบอีเวนต์นี้", 404);

  const origin = new URL(request.url).origin;
  const url = `${origin}/e/${event.id}`;
  const dataUrl = await QRCode.toDataURL(url, {
    margin: 2,
    width: 320,
    errorCorrectionLevel: "M",
  });

  return jsonOk({ id: event.id, name: event.name, url, dataUrl });
}
