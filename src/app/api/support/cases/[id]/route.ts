import { jsonError, jsonOk } from "@/lib/http";
import { getCaseByToken } from "@/lib/support-case-service";

type Params = { params: Promise<{ id: string }> };

/** Public — เปิดดูเคสด้วย token เท่านั้น (IP อย่างเดียวเปิดไม่ได้) */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return jsonError("ต้องมี token สำหรับติดตามเคส", 401);

  const supportCase = await getCaseByToken({ caseId: id, token });
  if (!supportCase) return jsonError("ไม่พบเคสหรือ token ไม่ถูกต้อง", 404);

  return jsonOk(
    {
      case: {
        ...supportCase,
        createdAt: supportCase.createdAt.toISOString(),
        updatedAt: supportCase.updatedAt.toISOString(),
        statusHistory: supportCase.statusHistory.map((h) => ({
          toStatus: h.toStatus,
          createdAt: h.createdAt.toISOString(),
        })),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
