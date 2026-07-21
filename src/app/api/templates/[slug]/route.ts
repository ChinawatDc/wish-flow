import { jsonError, jsonOk } from "@/lib/http";
import { getTemplateBySlug, templateHasGame } from "@/lib/template-service";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);
  if (!template) return jsonError("ไม่พบเทมเพลตนี้", 404);

  return jsonOk({
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    thumbnailUrl: template.thumbnailUrl,
    category: template.category,
    tags: template.tags,
    mood: template.mood,
    requiredAssetCount: template.requiredAssetCount,
    isPremium: template.isPremium,
    stepsSchema: template.stepsSchema,
    hasGame: templateHasGame(template.stepsSchema),
  });
}
