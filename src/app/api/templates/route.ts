import { jsonError, jsonOk } from "@/lib/http";
import { searchTemplates, templateQuerySchema } from "@/lib/template-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());

  const parsed = templateQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("พารามิเตอร์ค้นหาไม่ถูกต้อง", 400);
  }

  const result = await searchTemplates(parsed.data);
  return jsonOk(result);
}
