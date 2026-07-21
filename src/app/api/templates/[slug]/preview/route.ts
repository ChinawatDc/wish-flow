import { jsonError, jsonOk } from "@/lib/http";
import {
  getTemplateBySlug,
  SAMPLE_ASSETS,
  SAMPLE_TEMPLATE_DATA,
} from "@/lib/template-service";
import { parseStepsSchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string }> };

/** ข้อมูลตัวอย่างสำหรับ preview เทมเพลต — ใช้ current published version */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);
  if (!template) return jsonError("ไม่พบเทมเพลตนี้", 404);

  const version = template.currentPublishedVersion;
  const rawSchema = version?.stepsSchema ?? template.stepsSchema;
  const stepsSchema = parseStepsSchema(rawSchema);
  const sampleFromVersion =
    version?.sampleData && typeof version.sampleData === "object"
      ? (version.sampleData as Record<string, unknown>)
      : {};

  const fields = new Set<string>();
  for (const step of stepsSchema.steps) {
    for (const f of step.fields) fields.add(f);
  }

  const sampleData: Record<string, string> = {};
  for (const field of fields) {
    const fromVersion = sampleFromVersion[field];
    sampleData[field] =
      typeof fromVersion === "string"
        ? fromVersion
        : (SAMPLE_TEMPLATE_DATA[field] ?? "ตัวอย่างข้อความ");
  }

  return jsonOk({
    slug: template.slug,
    name: template.name,
    version: version?.version ?? null,
    templateVersionId: version?.id ?? null,
    stepsSchema,
    settings: version?.settings ?? {},
    templateData: sampleData,
    assets: SAMPLE_ASSETS,
  });
}
