/**
 * Shared step registry metadata — used by validation, seed, admin studio, and palette.
 * Renderer components stay in StepRenderer; this file is server-safe.
 */

export type StepGroup = "text" | "photo" | "minigame";

export type StepTypeMeta = {
  type: string;
  group: StepGroup;
  labelTh: string;
  labelEn: string;
  defaultFields: string[];
  /** Declares optional Pro/Expert capability keys this step understands */
  capabilities: string[];
};

export const STEP_TYPE_META: StepTypeMeta[] = [
  {
    type: "gift-box",
    group: "text",
    labelTh: "กล่องของขวัญ",
    labelEn: "Gift box",
    defaultFields: ["title_text"],
    capabilities: ["transition", "timing", "motion"],
  },
  {
    type: "text-reveal",
    group: "text",
    labelTh: "เผยข้อความ",
    labelEn: "Text reveal",
    defaultFields: ["message_text", "sender_name"],
    capabilities: ["transition", "timing", "motion", "typography"],
  },
  {
    type: "typewriter-message",
    group: "text",
    labelTh: "พิมพ์ดีด",
    labelEn: "Typewriter",
    defaultFields: ["typewriter_text", "sender_name"],
    capabilities: ["transition", "timing", "motion", "typography"],
  },
  {
    type: "envelope-open",
    group: "text",
    labelTh: "เปิดซองจดหมาย",
    labelEn: "Envelope",
    defaultFields: ["envelope_message", "sender_name"],
    capabilities: ["transition", "timing", "motion"],
  },
  {
    type: "countdown",
    group: "text",
    labelTh: "นับถอยหลัง",
    labelEn: "Countdown",
    defaultFields: ["countdown_title"],
    capabilities: ["transition", "timing", "motion"],
  },
  {
    type: "candle-blow",
    group: "text",
    labelTh: "เป่าเทียน",
    labelEn: "Candle blow",
    defaultFields: ["cake_style"],
    capabilities: ["transition", "timing", "motion", "interaction"],
  },
  {
    type: "final-celebration",
    group: "text",
    labelTh: "ฉลองปิดท้าย",
    labelEn: "Finale",
    defaultFields: ["final_message", "sender_name"],
    capabilities: ["transition", "timing", "motion", "typography"],
  },
  {
    type: "photo-reveal",
    group: "photo",
    labelTh: "เผยรูป",
    labelEn: "Photo reveal",
    defaultFields: ["photo_caption"],
    capabilities: ["transition", "timing", "media", "fallback"],
  },
  {
    type: "photo-polaroid",
    group: "photo",
    labelTh: "โพลารอยด์",
    labelEn: "Polaroid",
    defaultFields: ["polaroid_caption"],
    capabilities: ["transition", "timing", "media", "fallback"],
  },
  {
    type: "photo-slideshow",
    group: "photo",
    labelTh: "สไลด์โชว์",
    labelEn: "Slideshow",
    defaultFields: ["slideshow_caption"],
    capabilities: ["transition", "timing", "media", "fallback"],
  },
  {
    type: "photo-collage",
    group: "photo",
    labelTh: "คอลลาจ",
    labelEn: "Collage",
    defaultFields: ["collage_caption"],
    capabilities: ["transition", "timing", "media", "fallback"],
  },
  {
    type: "memory-timeline",
    group: "photo",
    labelTh: "ไทม์ไลน์",
    labelEn: "Timeline",
    defaultFields: ["timeline_caption"],
    capabilities: ["transition", "timing", "media", "fallback"],
  },
  {
    type: "scratch-card",
    group: "photo",
    labelTh: "ขูดการ์ด",
    labelEn: "Scratch card",
    defaultFields: ["scratch_caption"],
    capabilities: ["transition", "timing", "media", "interaction", "fallback"],
  },
  {
    type: "puzzle-photo",
    group: "photo",
    labelTh: "จิ๊กซอว์",
    labelEn: "Puzzle",
    defaultFields: ["puzzle_caption"],
    capabilities: ["transition", "timing", "media", "interaction", "fallback", "minigame"],
  },
  {
    type: "tap-the-balloon",
    group: "minigame",
    labelTh: "แตะลูกโป่ง",
    labelEn: "Tap balloon",
    defaultFields: ["balloon_message"],
    capabilities: ["transition", "timing", "interaction", "minigame", "motion", "fallback"],
  },
  {
    type: "catch-the-heart",
    group: "minigame",
    labelTh: "เก็บหัวใจ",
    labelEn: "Catch heart",
    defaultFields: ["heart_message"],
    capabilities: ["transition", "timing", "interaction", "minigame", "motion", "fallback"],
  },
  {
    type: "memory-match",
    group: "minigame",
    labelTh: "จับคู่ความจำ",
    labelEn: "Memory match",
    defaultFields: ["match_message"],
    capabilities: ["transition", "timing", "interaction", "minigame", "media", "fallback"],
  },
  {
    type: "birthday-quiz",
    group: "minigame",
    labelTh: "ควิซ",
    labelEn: "Quiz",
    defaultFields: [
      "quiz_question",
      "quiz_option_1",
      "quiz_option_2",
      "quiz_option_3",
      "quiz_correct",
    ],
    capabilities: ["transition", "timing", "interaction", "minigame", "fallback"],
  },
  {
    type: "spin-the-wheel",
    group: "minigame",
    labelTh: "หมุนวงล้อ",
    labelEn: "Spin wheel",
    defaultFields: ["wheel_wishes"],
    capabilities: ["transition", "timing", "interaction", "minigame", "motion", "fallback"],
  },
  {
    type: "find-the-gift",
    group: "minigame",
    labelTh: "ตามหาของขวัญ",
    labelEn: "Find gift",
    defaultFields: ["gift_message"],
    capabilities: ["transition", "timing", "interaction", "minigame", "fallback"],
  },
  {
    type: "confetti-pop",
    group: "minigame",
    labelTh: "คอนเฟตติ",
    labelEn: "Confetti",
    defaultFields: ["confetti_message"],
    capabilities: ["transition", "timing", "motion", "minigame", "fallback"],
  },
];

export const KNOWN_STEP_TYPES = STEP_TYPE_META.map((s) => s.type);

export const KNOWN_STEP_TYPE_SET = new Set(KNOWN_STEP_TYPES);

export const GAME_STEP_TYPES = STEP_TYPE_META.filter(
  (s) => s.group === "minigame",
).map((s) => s.type);

export const STEP_META_BY_TYPE = Object.fromEntries(
  STEP_TYPE_META.map((s) => [s.type, s]),
) as Record<string, StepTypeMeta>;

export const RESERVED_FIELD_KEYS = new Set([
  "id",
  "eventId",
  "templateId",
  "pin",
  "ownerUserId",
  "__proto__",
  "constructor",
  "prototype",
]);

export const FIELD_TYPES = [
  "short-text",
  "long-text",
  "rich-text",
  "image-slot",
  "date",
  "select",
  "multi-select",
  "repeater",
  "boolean",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const THEME_PRESETS = [
  "cute-pastel",
  "minimal-clean",
  "warm-romantic",
  "fun-party",
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];
