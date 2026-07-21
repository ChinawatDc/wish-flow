import QRCode from "qrcode";

import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const event = await prisma.event.findFirst({
      where: { id, ownerUserId: user.id },
      select: { id: true, name: true },
    });
    if (!event) return jsonError("ไม่พบอีเวนต์นี้", 404);

    const origin = new URL(request.url).origin;
    const url = `${origin}/e/${event.id}`;
    const dataUrl = await QRCode.toDataURL(url, {
      margin: 2,
      width: 320,
      color: { dark: "#9f1239", light: "#fff8f5" },
    });

    return jsonOk({ url, dataUrl, title: event.name });
  } catch (error) {
    return authErrorResponse(error);
  }
}
