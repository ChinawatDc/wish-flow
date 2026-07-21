import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/http";
import { addGuestMessage } from "@/lib/support-case-service";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  token: z.string().min(10).max(200),
  body: z.string().trim().min(1).max(4000),
});

/** Public — ผู้แจ้งตอบกลับเพิ่มผ่าน token */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("ข้อมูลไม่ถูกต้อง", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("ข้อมูลไม่ถูกต้อง", 400);

  const result = await addGuestMessage({
    caseId: id,
    token: parsed.data.token,
    body: parsed.data.body,
  });
  if ("error" in result) {
    const map: Record<string, { msg: string; status: number }> = {
      not_found: { msg: "ไม่พบเคสหรือ token ไม่ถูกต้อง", status: 404 },
      closed: { msg: "เคสนี้ถูกปิดแล้ว", status: 400 },
      empty: { msg: "กรุณากรอกข้อความ", status: 400 },
    };
    const info = (result.error ? map[result.error] : undefined) ?? {
      msg: "ดำเนินการไม่สำเร็จ",
      status: 400,
    };
    return jsonError(info.msg, info.status);
  }
  return jsonOk({ ok: true }, { status: 201 });
}
