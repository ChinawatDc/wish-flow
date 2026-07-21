import { cookies } from "next/headers";

import { unlockCookieName } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { sanitizeTemplateData } from "@/lib/sanitize";
import { resolveEventStepsSchema } from "@/lib/template-studio-service";
import { verifyUnlockToken } from "@/lib/unlock-token";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(unlockCookieName(id))?.value;
  if (!token) return jsonError("กรุณากรอก PIN ก่อนเข้าชม", 401);

  const valid = await verifyUnlockToken(token, id);
  if (!valid) return jsonError("เซสชันหมดอายุ กรุณากรอก PIN ใหม่", 401);

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      template: true,
      templateVersion: true,
      assets: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true },
      },
    },
  });
  if (!event || event.status !== "active") {
    return jsonError("ไม่พบอีเวนต์นี้", 404);
  }

  if (!event.template && !event.templateVersion) {
    return jsonError("อีเวนต์นี้ยังไม่ได้เลือกเทมเพลต", 400);
  }

  let stepsSchema;
  try {
    stepsSchema = resolveEventStepsSchema(event);
  } catch {
    return jsonError("เทมเพลตเสียหาย", 500);
  }
  if (!stepsSchema) {
    return jsonError("อีเวนต์นี้ยังไม่ได้เลือกเทมเพลต", 400);
  }

  const enabledSteps = {
    ...stepsSchema,
    steps: stepsSchema.steps.filter((s) => s.enabled !== false),
  };

  const templateData = sanitizeTemplateData(
    (event.templateData ?? {}) as Record<string, unknown>,
  );

  return jsonOk({
    id: event.id,
    name: event.name,
    eventDate: event.eventDate?.toISOString().slice(0, 10) ?? null,
    templateVersionId: event.templateVersionId,
    template: {
      slug: event.template?.slug ?? "unknown",
      name: event.template?.name ?? "Template",
      version: event.templateVersion?.version ?? null,
      stepsSchema: enabledSteps,
      settings: event.templateVersion?.settings ?? {},
    },
    templateData,
    assets: event.assets,
  });
}
