import { z } from "zod";

import { prisma } from "@/lib/db";
import { GAME_STEP_TYPES } from "@/lib/step-registry";

export const TEMPLATE_CATEGORIES = [
  "birthday",
  "photo",
  "minigame",
  "romantic",
  "friend",
  "family",
  "simple",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  birthday: "วันเกิด 🎂",
  photo: "รูปภาพ 📸",
  minigame: "มินิเกม 🎮",
  romantic: "โรแมนติก 💕",
  friend: "เพื่อน 🫶",
  family: "ครอบครัว 👨‍👩‍👧",
  simple: "เรียบง่าย ✨",
};

export const templateQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(TEMPLATE_CATEGORIES).optional(),
  hasGame: z.enum(["true", "false"]).optional(),
  premium: z.enum(["true", "false"]).optional(),
  mood: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
  sort: z.enum(["recommended", "newest", "popular"]).default("recommended"),
});

export type TemplateQuery = z.infer<typeof templateQuerySchema>;

export function templateHasGame(stepsSchema: unknown): boolean {
  const steps = (stepsSchema as { steps?: { type: string }[] })?.steps ?? [];
  return steps.some((s) => GAME_STEP_TYPES.includes(s.type));
}

export async function searchTemplates(query: TemplateQuery) {
  const where = {
    isActive: true,
    currentPublishedVersionId: { not: null as string | null },
    marketplaceVisibility: "PUBLIC" as const,
    ...(query.category ? { category: query.category } : {}),
    ...(query.mood ? { mood: query.mood } : {}),
    ...(query.premium ? { isPremium: query.premium === "true" } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { description: { contains: query.q, mode: "insensitive" as const } },
            { tags: { has: query.q } },
          ],
        }
      : {}),
  };

  const orderBy =
    query.sort === "newest"
      ? [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }]
      : query.sort === "popular"
        ? [{ usageCount: "desc" as const }, { sortOrder: "asc" as const }]
        : [{ sortOrder: "asc" as const }, { usageCount: "desc" as const }];

  const [total, rows] = await Promise.all([
    prisma.template.count({ where }),
    prisma.template.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { currentPublishedVersion: true },
    }),
  ]);

  let items = rows.map((t) => {
    const schema = t.currentPublishedVersion?.stepsSchema ?? t.stepsSchema;
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      category: t.category,
      tags: t.tags,
      mood: t.mood,
      requiredAssetCount: t.requiredAssetCount,
      isPremium: t.isPremium,
      isFeatured: t.isFeatured,
      usageCount: t.usageCount,
      stepsSchema: schema,
      currentVersion: t.currentPublishedVersion
        ? {
            id: t.currentPublishedVersion.id,
            version: t.currentPublishedVersion.version,
          }
        : null,
      hasGame: templateHasGame(schema),
      stepCount: ((schema as { steps?: unknown[] })?.steps ?? []).length,
    };
  });

  if (query.hasGame) {
    const want = query.hasGame === "true";
    items = items.filter((t) => t.hasGame === want);
  }

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getTemplateBySlug(slug: string) {
  return prisma.template.findFirst({
    where: {
      slug,
      isActive: true,
      currentPublishedVersionId: { not: null },
    },
    include: { currentPublishedVersion: true },
  });
}

/** ข้อมูลตัวอย่างสำหรับ preview — ไม่แตะข้อมูล event จริง */
export const SAMPLE_TEMPLATE_DATA: Record<string, string> = {
  title_text: "มีของขวัญพิเศษให้เธอ!",
  message_text: "สุขสันต์วันเกิดนะ ขอให้ปีนี้เป็นปีที่ดีที่สุดของเธอเลย 🎉",
  sender_name: "คนที่รักเธอ",
  cake_style: "ช็อกโกแลต",
  typewriter_text: "ขอบคุณที่เกิดมานะ... สุขสันต์วันเกิด!",
  envelope_message: "แง้มซองมาอ่านหน่อยสิ มีเรื่องอยากบอก...",
  countdown_title: "พร้อมหรือยัง?",
  final_message: "สุขสันต์วันเกิดอีกครั้งนะ 🎂✨",
  confetti_message: "ปาร์ตี้เริ่มแล้ว!",
  balloon_message: "เก่งมาก! นี่คือคำอวยพรของเธอ 🎈",
  heart_message: "เก็บหัวใจครบแล้ว! รักเธอนะ 💕",
  match_message: "ความจำดีมาก! สุขสันต์วันเกิด",
  quiz_question: "วันเกิดใครเอ่ย?",
  quiz_option_1: "ของเธอไง",
  quiz_option_2: "ของฉัน",
  quiz_option_3: "ของแมว",
  quiz_correct: "1",
  wheel_wishes: "ขอให้รวย, ขอให้สุขภาพดี, ขอให้เจอแต่คนดีๆ, ขอให้สอบผ่าน",
  gift_message: "เจอแล้ว! ของขวัญของเธอคือความสุขตลอดปี 🎁",
  photo_caption: "ความทรงจำดีๆ ของเรา",
  polaroid_caption: "รูปนี้น่ารักที่สุด",
  slideshow_caption: "เรื่องราวของเรา",
  collage_caption: "รวมโมเมนต์น่ารักๆ",
  timeline_caption: "เส้นทางของเรา",
  scratch_caption: "ขูดตรงนี้เลย!",
  puzzle_caption: "ต่อรูปให้ครบสิ!",
  guestbook_cta_title: "เขียนคำอวยพรให้เราหน่อยนะ",
  guestbook_cta_body: "ชื่อและรูปเป็นทางเลือก — ข้อความจะขึ้นกำแพงหลังเจ้าของอนุมัติ",
  guestbook_cta_button: "ไปสมุดอวยพร",
};

export const SAMPLE_ASSETS = [
  { id: "sample-1", url: "", emoji: "🌸" },
  { id: "sample-2", url: "", emoji: "🎈" },
  { id: "sample-3", url: "", emoji: "🧸" },
  { id: "sample-4", url: "", emoji: "🌈" },
];
