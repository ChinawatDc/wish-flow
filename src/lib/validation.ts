import { z } from "zod";

export const stepSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  fields: z.array(z.string()),
});

export const stepsSchemaZod = z.object({
  steps: z.array(stepSchema).min(1),
});

export type StepDef = z.infer<typeof stepSchema>;
export type StepsSchema = z.infer<typeof stepsSchemaZod>;

export function parseStepsSchema(raw: unknown): StepsSchema {
  return stepsSchemaZod.parse(raw);
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
