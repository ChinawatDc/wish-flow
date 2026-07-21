import { jsonError, jsonOk } from "@/lib/http";
import {
  getTemplateBySlug,
  SAMPLE_TEMPLATE_DATA,
} from "@/lib/template-service";
import { parseStepsSchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string }> };

/** ข้อมูลตัวอย่างสำหรับ preview เทมเพลต — ไม่แตะข้อมูล event จริง */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);
  if (!template) return jsonError("ไม่พบเทมเพลตนี้", 404);

  const stepsSchema = parseStepsSchema(template.stepsSchema);
  const fields = new Set<string>();
  for (const step of stepsSchema.steps) {
    for (const f of step.fields) fields.add(f);
  }

  const sampleData: Record<string, string> = {};
  for (const field of fields) {
    sampleData[field] = SAMPLE_TEMPLATE_DATA[field] ?? "ตัวอย่างข้อความ";
  }

  return jsonOk({
    slug: template.slug,
    name: template.name,
    stepsSchema,
    templateData: sampleData,
    assets: [],
  });
}
