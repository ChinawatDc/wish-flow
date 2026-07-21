import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TemplateSeed = {
  slug: string;
  name: string;
  description: string;
  thumbnail: string; // emoji:<char> แสดงเป็น thumbnail
  category: string;
  tags: string[];
  mood: string;
  requiredAssetCount: number;
  isPremium?: boolean;
  sortOrder: number;
  steps: { key: string; type: string; fields: string[] }[];
};

/**
 * Template = config ล้วนๆ ประกอบจาก step types ใน StepRenderer registry
 * เพิ่ม template ใหม่ = เพิ่ม object ที่นี่ ไม่ต้องเขียน component ใหม่
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
      { key: "opening", type: "gift-box", fields: ["title_text"] },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"] },
      { key: "cake", type: "candle-blow", fields: ["cake_style"] },
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
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"] },
      { key: "cake", type: "candle-blow", fields: ["cake_style"] },
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
      { key: "opening", type: "gift-box", fields: ["title_text"] },
      { key: "album", type: "photo-polaroid", fields: ["polaroid_caption"] },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"] },
      { key: "finale", type: "final-celebration", fields: ["final_message"] },
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
      { key: "countdown", type: "countdown", fields: ["countdown_title"] },
      { key: "timeline", type: "memory-timeline", fields: ["timeline_caption"] },
      { key: "message", type: "typewriter-message", fields: ["typewriter_text", "sender_name"] },
      { key: "finale", type: "final-celebration", fields: ["final_message"] },
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
      { key: "game", type: "tap-the-balloon", fields: ["balloon_message"] },
      { key: "photo", type: "photo-reveal", fields: ["photo_caption"] },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"] },
      { key: "finale", type: "confetti-pop", fields: ["confetti_message"] },
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
      { key: "game", type: "memory-match", fields: ["match_message"] },
      { key: "slideshow", type: "photo-slideshow", fields: ["slideshow_caption"] },
      { key: "finale", type: "final-celebration", fields: ["final_message", "sender_name"] },
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
      { key: "wheel", type: "spin-the-wheel", fields: ["wheel_wishes"] },
      { key: "letter", type: "envelope-open", fields: ["envelope_message", "sender_name"] },
      { key: "cake", type: "candle-blow", fields: ["cake_style"] },
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
      { key: "scratch", type: "scratch-card", fields: ["scratch_caption"] },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"] },
      { key: "finale", type: "confetti-pop", fields: ["confetti_message"] },
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
      { key: "letter", type: "envelope-open", fields: ["envelope_message"] },
      { key: "collage", type: "photo-collage", fields: ["collage_caption"] },
      { key: "message", type: "typewriter-message", fields: ["typewriter_text", "sender_name"] },
      { key: "finale", type: "final-celebration", fields: ["final_message"] },
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
      { key: "game", type: "find-the-gift", fields: ["gift_message"] },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"] },
      { key: "cake", type: "candle-blow", fields: ["cake_style"] },
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
      },
      { key: "photo", type: "photo-reveal", fields: ["photo_caption"] },
      { key: "finale", type: "final-celebration", fields: ["final_message", "sender_name"] },
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
      { key: "puzzle", type: "puzzle-photo", fields: ["puzzle_caption"] },
      { key: "message", type: "text-reveal", fields: ["message_text", "sender_name"] },
      { key: "finale", type: "confetti-pop", fields: ["confetti_message"] },
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
      { key: "game", type: "catch-the-heart", fields: ["heart_message"] },
      { key: "slideshow", type: "photo-slideshow", fields: ["slideshow_caption"] },
      { key: "finale", type: "final-celebration", fields: ["final_message", "sender_name"] },
    ],
  },
];

async function main() {
  for (const t of TEMPLATES) {
    const data = {
      name: t.name,
      description: t.description,
      thumbnailUrl: t.thumbnail,
      stepsSchema: { steps: t.steps },
      isActive: true,
      category: t.category,
      tags: t.tags,
      mood: t.mood,
      requiredAssetCount: t.requiredAssetCount,
      isPremium: t.isPremium ?? false,
      sortOrder: t.sortOrder,
      publishedAt: new Date(),
    };
    await prisma.template.upsert({
      where: { slug: t.slug },
      update: data,
      create: { slug: t.slug, ...data },
    });
  }
  console.log(`Seeded ${TEMPLATES.length} templates`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
