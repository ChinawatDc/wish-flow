import { z } from "zod";

import {
  FIELD_TYPES,
  KNOWN_STEP_TYPE_SET,
  RESERVED_FIELD_KEYS,
  STEP_META_BY_TYPE,
  THEME_PRESETS,
} from "@/lib/step-registry";

export const stepSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/i),
  type: z.string().min(1),
  fields: z.array(z.string().min(1).max(64)).default([]),
  enabled: z.boolean().optional().default(true),
  section: z.enum(["opening", "body", "finale"]).optional().default("body"),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  elementOverrides: z.record(z.string(), z.unknown()).optional().default({}),
});

export const stepsSchemaZod = z.object({
  schemaVersion: z.number().int().min(1).max(10).optional().default(1),
  steps: z.array(stepSchema).min(1).max(40),
});

export type StepDef = z.infer<typeof stepSchema>;
export type StepsSchema = z.infer<typeof stepsSchemaZod>;

export function parseStepsSchema(raw: unknown): StepsSchema {
  return stepsSchemaZod.parse(raw);
}

export function parseStepsSchemaLoose(raw: unknown): StepsSchema | null {
  const parsed = stepsSchemaZod.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const pinSchema = z.string().regex(/^\d{6}$/);

export const createEventSchema = z.object({
  name: z.string().trim().min(1).max(120),
  pin: pinSchema.optional(),
});

export const changePinSchema = z.object({
  pin: pinSchema.optional(),
});

export const updateEventSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  templateId: z.string().uuid().nullable().optional(),
  templateData: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "active", "archived", "expired"]).optional(),
});

export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
});

export const fieldDefSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/i),
  type: z.enum(FIELD_TYPES),
  labelTh: z.string().trim().min(1).max(120),
  labelEn: z.string().trim().min(1).max(120),
  helpText: z.string().trim().max(500).optional(),
  required: z.boolean().default(false),
  minLength: z.number().int().min(0).max(10000).optional(),
  maxLength: z.number().int().min(1).max(10000).optional(),
  pattern: z.string().max(200).optional(),
  options: z.array(z.string().min(1).max(120)).max(50).optional(),
  defaultValue: z.unknown().optional(),
  sampleValue: z.unknown().optional(),
  mappedSteps: z.array(z.string()).optional(),
});

export const dataModelSchema = z.object({
  fields: z.array(fieldDefSchema).max(80).default([]),
});

export type DataModel = z.infer<typeof dataModelSchema>;

export const templateSettingsSchema = z.object({
  mode: z.enum(["basic", "pro", "expert"]).default("basic"),
  theme: z
    .object({
      preset: z.enum(THEME_PRESETS).default("cute-pastel"),
      primaryColor: z.string().max(32).optional(),
      fontPair: z.string().max(64).optional(),
      coverImageUrl: z.string().max(500).optional(),
    })
    .default({ preset: "cute-pastel" }),
  motion: z
    .object({
      intensity: z.enum(["subtle", "normal", "lively"]).default("normal"),
      reducedMotionPolicy: z
        .enum(["honor-prefers", "force-reduced", "ignore"])
        .default("honor-prefers"),
    })
    .default({ intensity: "normal", reducedMotionPolicy: "honor-prefers" }),
  audio: z
    .object({
      policy: z.enum(["off", "optional", "autoplay-muted"]).default("optional"),
    })
    .default({ policy: "optional" }),
  performance: z
    .object({
      maxAssetCount: z.number().int().min(0).max(24).default(12),
      maxTotalAssetBytes: z.number().int().min(0).max(30 * 1024 * 1024).default(15 * 1024 * 1024),
    })
    .default({ maxAssetCount: 12, maxTotalAssetBytes: 15 * 1024 * 1024 }),
  runtimeRules: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        when: z.object({
          op: z.enum([
            "field-empty",
            "field-equals",
            "field-present",
            "asset-missing",
            "reduced-motion",
          ]),
          fieldKey: z.string().optional(),
          value: z.unknown().optional(),
        }),
        then: z.object({
          action: z.enum([
            "hide-step",
            "show-step",
            "use-fallback-emoji",
            "skip-animation",
          ]),
          stepKey: z.string().optional(),
        }),
      }),
    )
    .max(40)
    .default([]),
});

export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

export type ValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};

export type TemplateValidationResult = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stepsSchema: StepsSchema | null;
  dataModel: DataModel | null;
  settings: TemplateSettings | null;
};

const CURRENT_SCHEMA_VERSION = 1;
const MAX_STEPS = 40;

export function validateTemplateDraft(input: {
  stepsSchema: unknown;
  dataModel?: unknown;
  settings?: unknown;
  sampleData?: unknown;
  requiredAssetCount?: number;
  assetCount?: number;
  assetTotalBytes?: number;
  previousPublishedStepsSchema?: unknown;
}): TemplateValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const stepsParsed = stepsSchemaZod.safeParse(input.stepsSchema);
  if (!stepsParsed.success) {
    errors.push({
      level: "error",
      code: "steps_schema_invalid",
      message: "โครงสร้าง steps_schema ไม่ถูกต้อง",
      path: "stepsSchema",
    });
    return { ok: false, errors, warnings, stepsSchema: null, dataModel: null, settings: null };
  }

  const stepsSchema = stepsParsed.data;
  if ((stepsSchema.schemaVersion ?? 1) !== CURRENT_SCHEMA_VERSION) {
    errors.push({
      level: "error",
      code: "schema_version_unsupported",
      message: `รองรับ schemaVersion = ${CURRENT_SCHEMA_VERSION} เท่านั้น`,
      path: "stepsSchema.schemaVersion",
    });
  }

  if (stepsSchema.steps.length > MAX_STEPS) {
    errors.push({
      level: "error",
      code: "too_many_steps",
      message: `จำนวน step เกิน ${MAX_STEPS}`,
      path: "stepsSchema.steps",
    });
  }

  const keys = new Set<string>();
  for (const [index, step] of stepsSchema.steps.entries()) {
    if (keys.has(step.key)) {
      errors.push({
        level: "error",
        code: "duplicate_step_key",
        message: `step key ซ้ำ: ${step.key}`,
        path: `stepsSchema.steps[${index}].key`,
      });
    }
    keys.add(step.key);

    if (!KNOWN_STEP_TYPE_SET.has(step.type)) {
      errors.push({
        level: "error",
        code: "unknown_step_type",
        message: `step type ไม่อยู่ใน registry: ${step.type}`,
        path: `stepsSchema.steps[${index}].type`,
      });
      continue;
    }

    const meta = STEP_META_BY_TYPE[step.type];
    for (const cap of Object.keys(step.settings ?? {})) {
      if (meta && !meta.capabilities.includes(cap) && !["layout", "label"].includes(cap)) {
        warnings.push({
          level: "warning",
          code: "unknown_step_setting",
          message: `setting "${cap}" ไม่ได้อยู่ใน capability ของ ${step.type}`,
          path: `stepsSchema.steps[${index}].settings.${cap}`,
        });
      }
    }
  }

  const enabledSteps = stepsSchema.steps.filter((s) => s.enabled !== false);
  if (enabledSteps.length === 0) {
    errors.push({
      level: "error",
      code: "no_enabled_steps",
      message: "ต้องมี step ที่เปิดใช้อย่างน้อย 1 ขั้น",
      path: "stepsSchema.steps",
    });
  }

  const dataModelParsed = dataModelSchema.safeParse(input.dataModel ?? { fields: [] });
  if (!dataModelParsed.success) {
    errors.push({
      level: "error",
      code: "data_model_invalid",
      message: "โครงสร้าง data model ไม่ถูกต้อง",
      path: "dataModel",
    });
  }
  const dataModel = dataModelParsed.success ? dataModelParsed.data : null;

  if (dataModel) {
    const fieldKeys = new Set<string>();
    for (const [index, field] of dataModel.fields.entries()) {
      if (RESERVED_FIELD_KEYS.has(field.key)) {
        errors.push({
          level: "error",
          code: "reserved_field_key",
          message: `field key สงวนไว้: ${field.key}`,
          path: `dataModel.fields[${index}].key`,
        });
      }
      if (fieldKeys.has(field.key)) {
        errors.push({
          level: "error",
          code: "duplicate_field_key",
          message: `field key ซ้ำ: ${field.key}`,
          path: `dataModel.fields[${index}].key`,
        });
      }
      fieldKeys.add(field.key);
    }

    const referenced = new Set<string>();
    for (const step of stepsSchema.steps) {
      for (const f of step.fields) referenced.add(f);
    }
    for (const ref of referenced) {
      if (!fieldKeys.has(ref) && dataModel.fields.length > 0) {
        warnings.push({
          level: "warning",
          code: "unmapped_step_field",
          message: `step อ้าง field ที่ไม่มีใน data model: ${ref}`,
          path: "dataModel.fields",
        });
      }
    }
  }

  const settingsParsed = templateSettingsSchema.safeParse(input.settings ?? {});
  if (!settingsParsed.success) {
    errors.push({
      level: "error",
      code: "settings_invalid",
      message: "โครงสร้าง settings ไม่ถูกต้อง",
      path: "settings",
    });
  }
  const settings = settingsParsed.success ? settingsParsed.data : null;

  const sampleData =
    input.sampleData && typeof input.sampleData === "object"
      ? (input.sampleData as Record<string, unknown>)
      : {};

  const requiredFields = new Set<string>();
  for (const step of enabledSteps) {
    for (const f of step.fields) requiredFields.add(f);
  }
  if (dataModel) {
    for (const field of dataModel.fields) {
      if (field.required) requiredFields.add(field.key);
    }
  }

  for (const key of requiredFields) {
    const value = sampleData[key] ?? dataModel?.fields.find((f) => f.key === key)?.sampleValue;
    if (value == null || String(value).trim() === "") {
      errors.push({
        level: "error",
        code: "missing_sample_data",
        message: `ขาด sample data สำหรับ field: ${key}`,
        path: `sampleData.${key}`,
      });
    }
  }

  // Accessibility / QA baseline (publish gate helpers)
  for (const [index, step] of enabledSteps.entries()) {
    if (!step.key || step.key.length < 2) {
      errors.push({
        level: "error",
        code: "a11y_step_label",
        message: "step key สั้นเกินไปสำหรับ accessibility baseline",
        path: `stepsSchema.steps[${index}].key`,
      });
    }
  }

  if (settings) {
    const assetCount = input.assetCount ?? 0;
    const assetBytes = input.assetTotalBytes ?? 0;
    const requiredAssets = input.requiredAssetCount ?? 0;
    if (assetCount > settings.performance.maxAssetCount) {
      errors.push({
        level: "error",
        code: "asset_count_budget",
        message: `จำนวน asset เกินงบ ${settings.performance.maxAssetCount}`,
        path: "assets",
      });
    }
    if (assetBytes > settings.performance.maxTotalAssetBytes) {
      errors.push({
        level: "error",
        code: "asset_bytes_budget",
        message: "ขนาดรวมของ asset เกินงบประมาณ",
        path: "assets",
      });
    }
    if (requiredAssets > 0 && assetCount === 0) {
      warnings.push({
        level: "warning",
        code: "required_assets_unmet_in_studio",
        message: "เทมเพลตต้องการรูป แต่ยังไม่มี template assets (guest ใช้ event assets ได้)",
        path: "requiredAssetCount",
      });
    }

    if (settings.motion.reducedMotionPolicy === "ignore") {
      warnings.push({
        level: "warning",
        code: "reduced_motion_ignored",
        message: "reduced-motion ถูกตั้งเป็น ignore — อาจกระทบ accessibility",
        path: "settings.motion.reducedMotionPolicy",
      });
    }

    for (const [index, rule] of settings.runtimeRules.entries()) {
      if (
        (rule.then.action === "hide-step" || rule.then.action === "show-step") &&
        rule.then.stepKey &&
        !keys.has(rule.then.stepKey)
      ) {
        errors.push({
          level: "error",
          code: "runtime_rule_unknown_step",
          message: `runtime rule อ้าง step ที่ไม่มี: ${rule.then.stepKey}`,
          path: `settings.runtimeRules[${index}]`,
        });
      }
    }
  }

  // Minigame compatibility: registered minigame steps keep skip in renderer
  for (const [index, step] of enabledSteps.entries()) {
    const meta = STEP_META_BY_TYPE[step.type];
    if (meta?.group === "minigame" && !meta.capabilities.includes("minigame")) {
      errors.push({
        level: "error",
        code: "minigame_incompatible",
        message: `มินิเกม ${step.type} ไม่ผ่าน capability baseline`,
        path: `stepsSchema.steps[${index}]`,
      });
    }
  }

  if (input.previousPublishedStepsSchema) {
    const prev = parseStepsSchemaLoose(input.previousPublishedStepsSchema);
    if (prev) {
      const prevKeys = new Set(prev.steps.map((s) => s.key));
      const removed = [...prevKeys].filter((k) => !keys.has(k));
      if (removed.length > 0) {
        warnings.push({
          level: "warning",
          code: "breaking_step_removed",
          message: `ลบ step keys จาก published เดิม: ${removed.join(", ")} — ควรทำเครื่องหมาย breaking`,
          path: "stepsSchema",
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stepsSchema,
    dataModel,
    settings,
  };
}
