import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { forkMarketplaceCard } from "@/lib/card-marketplace-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await forkMarketplaceCard({
      userId: user.id,
      listingId: id,
    });
    if ("error" in result) {
      if (result.error === "not_found") return jsonError("ไม่พบการ์ดนี้", 404);
      if (result.error === "cannot_use_own") {
        return jsonError("ไม่สามารถนำไปใช้การ์ดของตัวเองได้ — ใช้ปุ่มทำซ้ำแทน", 400);
      }
      return jsonError("นำไปใช้ไม่สำเร็จ", 400);
    }
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
