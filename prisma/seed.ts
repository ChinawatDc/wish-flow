import { PrismaClient } from "@prisma/client";

import { SAMPLE_TEMPLATE_DATA } from "../src/lib/template-service";

const prisma = new PrismaClient();

type TemplateSeed = {
  slug: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  tags: string[];
  mood: string;
  requiredAssetCount: number;
  isPremium?: boolean;
  sortOrder: number;
  steps: { key: string; type: string; fields: string[]; enabled?: boolean; section?: string }[];
};

/**
 * Template catalog seed — metadata can upsert; published steps_schema is immutable.
 * New schema changes create a draft version only when no draft exists and published differs.
 */
const TEMPLATES: TemplateSeed[] = [
  {
    slug: "hbd-classic",
    name: "กล่องของขวัญคลาสสิก 🎂",
    description: "เปิดกล่องของขวัญ → คำอวยพร → เป่าเทียน ครบทุกโมเมนต์",
    thumbnail: "emoji:🎁",
    category: "birthday",
    tags: ["วันเกิด", "คลาสสิก", "ของขวัญ"],
    mood: "cute",
    requiredAssetCount: 0,
    sortOrder: 1,
    steps: [
      { key: "opening", type: "gift-box", fields: ["title_text"], section: "opening" },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"], section: "body" },
      { key: "cake", type: "candle-blow", fields: ["cake_style"], section: "finale" },
    ],
  },
  {
    slug: "hbd-short",
    name: "แบบสั้นสำหรับมือถือ 💌",
    description: "คำอวยพร + เป่าเทียน แบบเร็วๆ น่ารักๆ",
    thumbnail: "emoji:💌",
    category: "simple",
    tags: ["สั้น", "เรียบง่าย", "เร็ว"],
    mood: "minimal",
    requiredAssetCount: 0,
    sortOrder: 2,
    steps: [
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"], section: "body" },
      { key: "cake", type: "candle-blow", fields: ["cake_style"], section: "finale" },
    ],
  },
  {
    slug: "polaroid-album",
    name: "อัลบั้มโพลารอยด์ 📸",
    description: "เปิดกล่อง → ไล่ดูรูปโพลารอยด์ทีละใบ → คำอวยพรปิดท้าย",
    thumbnail: "emoji:📸",
    category: "photo",
    tags: ["รูปภาพ", "โพลารอยด์", "อัลบั้ม"],
    mood: "warm",
    requiredAssetCount: 3,
    sortOrder: 3,
    steps: [
      { key: "opening", type: "gift-box", fields: ["title_text"], section: "opening" },
      { key: "album", type: "photo-polaroid", fields: ["polaroid_caption"], section: "body" },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"], section: "body" },
      { key: "finale", type: "final-celebration", fields: ["final_message"], section: "finale" },
    ],
  },
  {
    slug: "memory-lane",
    name: "เส้นทางความทรงจำ 🛤️",
    description: "นับถอยหลัง → ไทม์ไลน์รูปความทรงจำ → ข้อความพิมพ์ดีดสุดซึ้ง",
    thumbnail: "emoji:🛤️",
    category: "photo",
    tags: ["รูปภาพ", "ไทม์ไลน์", "ความทรงจำ", "ซึ้ง"],
    mood: "warm",
    requiredAssetCount: 3,
    sortOrder: 4,
    steps: [
      { key: "countdown", type: "countdown", fields: ["countdown_title"], section: "opening" },
      { key: "timeline", type: "memory-timeline", fields: ["timeline_caption"], section: "body" },
      { key: "message", type: "typewriter-message", fields: ["typewriter_text", "sender_name"], section: "body" },
      { key: "finale", type: "final-celebration", fields: ["final_message"], section: "finale" },
    ],
  },
  {
    slug: "balloon-party",
    name: "แตะลูกโป่งเปิดคำอวยพร 🎈",
    description: "แตะลูกโป่งให้แตกครบ → เผยรูป → คำอวยพร → คอนเฟตติ",
    thumbnail: "emoji:🎈",
    category: "minigame",
    tags: ["มินิเกม", "ลูกโป่ง", "สนุก"],
    mood: "playful",
    requiredAssetCount: 1,
    sortOrder: 5,
    steps: [
      { key: "game", type: "tap-the-balloon", fields: ["balloon_message"], section: "opening" },
      { key: "photo", type: "photo-reveal", fields: ["photo_caption"], section: "body" },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"], section: "body" },
      { key: "finale", type: "confetti-pop", fields: ["confetti_message"], section: "finale" },
    ],
  },
  {
    slug: "memory-match-game",
    name: "จับคู่ภาพความทรงจำ 🧠",
    description: "เล่นเกมจับคู่รูป → สไลด์โชว์ความทรงจำ → ฉลองปิดท้าย",
    thumbnail: "emoji:🧠",
    category: "minigame",
    tags: ["มินิเกม", "จับคู่", "รูปภาพ"],
    mood: "playful",
    requiredAssetCount: 4,
    sortOrder: 6,
    steps: [
      { key: "game", type: "memory-match", fields: ["match_message"], section: "opening" },
      { key: "slideshow", type: "photo-slideshow", fields: ["slideshow_caption"], section: "body" },
      { key: "finale", type: "final-celebration", fields: ["final_message", "sender_name"], section: "finale" },
    ],
  },
  {
    slug: "lucky-wheel",
    name: "หมุนวงล้อรับคำอวยพร 🎡",
    description: "หมุนวงล้อสุ่มคำอวยพร → เปิดซองจดหมาย → เป่าเทียน",
    thumbnail: "emoji:🎡",
    category: "minigame",
    tags: ["มินิเกม", "วงล้อ", "สุ่ม"],
    mood: "playful",
    requiredAssetCount: 0,
    sortOrder: 7,
    steps: [
      { key: "wheel", type: "spin-the-wheel", fields: ["wheel_wishes"], section: "opening" },
      { key: "letter", type: "envelope-open", fields: ["envelope_message", "sender_name"], section: "body" },
      { key: "cake", type: "candle-blow", fields: ["cake_style"], section: "finale" },
    ],
  },
  {
    slug: "scratch-surprise",
    name: "ขูดการ์ดเปิดรูป ✨",
    description: "ขูดการ์ดเผยรูปเซอร์ไพรส์ → คำอวยพร → คอนเฟตติ",
    thumbnail: "emoji:🪙",
    category: "photo",
    tags: ["รูปภาพ", "ขูด", "เซอร์ไพรส์", "มินิเกม"],
    mood: "playful",
    requiredAssetCount: 1,
    sortOrder: 8,
    steps: [
      { key: "scratch", type: "scratch-card", fields: ["scratch_caption"], section: "opening" },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"], section: "body" },
      { key: "finale", type: "confetti-pop", fields: ["confetti_message"], section: "finale" },
    ],
  },
  {
    slug: "love-letter",
    name: "จดหมายรัก 💕",
    description: "เปิดซองจดหมาย → คอลลาจรูปคู่ → ข้อความพิมพ์ดีดสุดโรแมนติก",
    thumbnail: "emoji:💕",
    category: "romantic",
    tags: ["โรแมนติก", "จดหมาย", "คู่รัก"],
    mood: "romantic",
    requiredAssetCount: 4,
    sortOrder: 9,
    steps: [
      { key: "letter", type: "envelope-open", fields: ["envelope_message"], section: "opening" },
      { key: "collage", type: "photo-collage", fields: ["collage_caption"], section: "body" },
      { key: "message", type: "typewriter-message", fields: ["typewriter_text", "sender_name"], section: "body" },
      { key: "finale", type: "final-celebration", fields: ["final_message"], section: "finale" },
    ],
  },
  {
    slug: "find-gift-mini",
    name: "ตามหาของขวัญ 🔍",
    description: "หาของขวัญที่ซ่อนอยู่ → คำอวยพร → เป่าเทียน",
    thumbnail: "emoji:🔍",
    category: "friend",
    tags: ["มินิเกม", "ของขวัญ", "เพื่อน"],
    mood: "playful",
    requiredAssetCount: 0,
    sortOrder: 10,
    steps: [
      { key: "game", type: "find-the-gift", fields: ["gift_message"], section: "opening" },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"], section: "body" },
      { key: "cake", type: "candle-blow", fields: ["cake_style"], section: "finale" },
    ],
  },
  {
    slug: "quiz-bday",
    name: "ควิซวันเกิด 🤔",
    description: "ตอบควิซให้ถูก → เผยรูป → ฉลองปิดท้าย เหมาะแกล้งเพื่อน",
    thumbnail: "emoji:🤔",
    category: "friend",
    tags: ["มินิเกม", "ควิซ", "เพื่อน", "แกล้ง"],
    mood: "funny",
    requiredAssetCount: 1,
    sortOrder: 11,
    steps: [
      {
        key: "quiz",
        type: "birthday-quiz",
        fields: ["quiz_question", "quiz_option_1", "quiz_option_2", "quiz_option_3", "quiz_correct"],
        section: "opening",
      },
      { key: "photo", type: "photo-reveal", fields: ["photo_caption"], section: "body" },
      { key: "finale", type: "final-celebration", fields: ["final_message", "sender_name"], section: "finale" },
    ],
  },
  {
    slug: "puzzle-memory",
    name: "ต่อจิ๊กซอว์ความทรงจำ 🧩",
    description: "สลับชิ้นส่วนรูปให้ถูก → คำอวยพร → คอนเฟตติ เหมาะกับครอบครัว",
    thumbnail: "emoji:🧩",
    category: "family",
    tags: ["มินิเกม", "จิ๊กซอว์", "ครอบครัว", "รูปภาพ"],
    mood: "warm",
    requiredAssetCount: 1,
    sortOrder: 12,
    steps: [
      { key: "puzzle", type: "puzzle-photo", fields: ["puzzle_caption"], section: "opening" },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"], section: "body" },
      { key: "finale", type: "confetti-pop", fields: ["confetti_message"], section: "finale" },
    ],
  },
  {
    slug: "heart-catch",
    name: "เก็บหัวใจให้ครบ 💗",
    description: "เก็บหัวใจที่ลอยมา → สไลด์โชว์รูปคู่ → ข้อความปิดท้ายสุดหวาน",
    thumbnail: "emoji:💗",
    category: "romantic",
    tags: ["มินิเกม", "หัวใจ", "โรแมนติก"],
    mood: "romantic",
    requiredAssetCount: 2,
    sortOrder: 13,
    steps: [
      { key: "game", type: "catch-the-heart", fields: ["heart_message"], section: "opening" },
      { key: "slideshow", type: "photo-slideshow", fields: ["slideshow_caption"], section: "body" },
      { key: "finale", type: "final-celebration", fields: ["final_message", "sender_name"], section: "finale" },
    ],
  },
  {
    slug: "wedding-guestbook",
    name: "งานแต่ง + สมุดอวยพร 💍",
    description: "เปิดซอง → คำอวยพร → ชวนเขียนสมุดอวยพร → ฉลองปิดท้าย (เหมาะโหมดสาธารณะ)",
    thumbnail: "emoji:💍",
    category: "romantic",
    tags: ["งานแต่ง", "สมุดอวยพร", "สาธารณะ", "โรแมนติก"],
    mood: "romantic",
    requiredAssetCount: 0,
    sortOrder: 14,
    steps: [
      { key: "letter", type: "envelope-open", fields: ["envelope_message", "sender_name"], section: "opening" },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"], section: "body" },
      {
        key: "guestbook",
        type: "guestbook-cta",
        fields: ["guestbook_cta_title", "guestbook_cta_body", "guestbook_cta_button"],
        section: "body",
      },
      { key: "finale", type: "final-celebration", fields: ["final_message"], section: "finale" },
    ],
  },
];

function buildStepsSchema(steps: TemplateSeed["steps"]) {
  return {
    schemaVersion: 1,
    steps: steps.map((s) => ({
      key: s.key,
      type: s.type,
      fields: s.fields,
      enabled: s.enabled ?? true,
      section: s.section ?? "body",
      settings: {},
      elementOverrides: {},
    })),
  };
}

function buildSampleData(steps: TemplateSeed["steps"]) {
  const fields = new Set<string>();
  for (const step of steps) {
    for (const f of step.fields) fields.add(f);
  }
  const sample: Record<string, string> = {};
  for (const field of fields) {
    sample[field] = SAMPLE_TEMPLATE_DATA[field] ?? "ตัวอย่างข้อความ";
  }
  return sample;
}

function buildDefaultDataModel(steps: TemplateSeed["steps"]) {
  const fields: Record<
    string,
    {
      key: string;
      type: string;
      labelTh: string;
      labelEn: string;
      required: boolean;
      sampleValue: string;
    }
  > = {};
  for (const step of steps) {
    for (const key of step.fields) {
      if (fields[key]) continue;
      fields[key] = {
        key,
        type: "long-text",
        labelTh: key,
        labelEn: key,
        required: true,
        sampleValue: SAMPLE_TEMPLATE_DATA[key] ?? "ตัวอย่างข้อความ",
      };
    }
  }
  return { fields: Object.values(fields) };
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

async function ensurePublishedVersion(params: {
  templateId: string;
  stepsSchema: ReturnType<typeof buildStepsSchema>;
  sampleData: Record<string, string>;
  dataModel: ReturnType<typeof buildDefaultDataModel>;
}) {
  const published = await prisma.templateVersion.findFirst({
    where: { templateId: params.templateId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });

  if (!published) {
    const created = await prisma.templateVersion.create({
      data: {
        templateId: params.templateId,
        version: 1,
        status: "PUBLISHED",
        schemaVersion: 1,
        stepsSchema: params.stepsSchema,
        dataModel: params.dataModel,
        settings: {
          mode: "basic",
          theme: { preset: "cute-pastel" },
          motion: { intensity: "normal", reducedMotionPolicy: "honor-prefers" },
        },
        sampleData: params.sampleData,
        releaseNotes: "Seed published v1",
        publishedAt: new Date(),
      },
    });
    await prisma.template.update({
      where: { id: params.templateId },
      data: {
        currentPublishedVersionId: created.id,
        stepsSchema: params.stepsSchema,
        publishedAt: created.publishedAt,
      },
    });
    return;
  }

  // Never mutate published steps_schema — only refresh catalog denormalized cache from published
  await prisma.template.update({
    where: { id: params.templateId },
    data: {
      currentPublishedVersionId: published.id,
      stepsSchema: published.stepsSchema as object,
      publishedAt: published.publishedAt ?? new Date(),
    },
  });

  const publishedSteps = stableJson(published.stepsSchema);
  const seedSteps = stableJson(params.stepsSchema);
  if (publishedSteps === seedSteps) return;

  const existingDraft = await prisma.templateVersion.findFirst({
    where: { templateId: params.templateId, status: "DRAFT" },
    orderBy: { version: "desc" },
  });
  if (existingDraft) return;

  const maxVersion = await prisma.templateVersion.aggregate({
    where: { templateId: params.templateId },
    _max: { version: true },
  });
  await prisma.templateVersion.create({
    data: {
      templateId: params.templateId,
      version: (maxVersion._max.version ?? published.version) + 1,
      status: "DRAFT",
      schemaVersion: 1,
      stepsSchema: params.stepsSchema,
      dataModel: params.dataModel,
      settings: published.settings as object,
      sampleData: params.sampleData,
      releaseNotes: null,
    },
  });
}

async function main() {
  for (const t of TEMPLATES) {
    const stepsSchema = buildStepsSchema(t.steps);
    const sampleData = buildSampleData(t.steps);
    const dataModel = buildDefaultDataModel(t.steps);
    const meta = {
      name: t.name,
      description: t.description,
      thumbnailUrl: t.thumbnail,
      isActive: true,
      category: t.category,
      tags: t.tags,
      mood: t.mood,
      requiredAssetCount: t.requiredAssetCount,
      isPremium: t.isPremium ?? false,
      sortOrder: t.sortOrder,
    };

    const existing = await prisma.template.findUnique({ where: { slug: t.slug } });
    if (!existing) {
      const created = await prisma.template.create({
        data: {
          slug: t.slug,
          ...meta,
          stepsSchema,
          publishedAt: new Date(),
        },
      });
      await ensurePublishedVersion({
        templateId: created.id,
        stepsSchema,
        sampleData,
        dataModel,
      });
    } else {
      await prisma.template.update({
        where: { id: existing.id },
        data: meta,
      });
      await ensurePublishedVersion({
        templateId: existing.id,
        stepsSchema,
        sampleData,
        dataModel,
      });
    }
  }
  console.log(`Seeded ${TEMPLATES.length} templates (metadata upsert; published schemas immutable)`);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const bcrypt = await import("bcryptjs");
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Admin",
          passwordHash: await bcrypt.hash(adminPassword, 12),
          role: "ADMIN",
        },
      });
      console.log(`Bootstrapped ADMIN user: ${adminEmail}`);
    } else if (existing.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN" },
      });
      console.log(`Promoted existing user to ADMIN: ${adminEmail}`);
    } else {
      console.log(`Admin already exists: ${adminEmail}`);
    }
  } else {
    console.log("Skip admin bootstrap (set ADMIN_EMAIL + ADMIN_PASSWORD to create)");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
