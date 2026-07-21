import type { DeviceClass, TemplateTelemetryKind } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";

export const telemetryIngestSchema = z.object({
  kind: z.enum(["STEP_START", "STEP_COMPLETE", "STEP_SKIP", "FLOW_COMPLETE"]),
  stepKey: z.string().trim().max(64).optional(),
  stepType: z.string().trim().max(64).optional(),
  stepIndex: z.number().int().min(0).max(100).optional(),
  deviceClass: z.enum(["MOBILE", "TABLET", "DESKTOP", "UNKNOWN"]).default("UNKNOWN"),
});

export async function recordTelemetry(params: {
  eventId: string;
  kind: TemplateTelemetryKind;
  stepKey?: string;
  stepType?: string;
  stepIndex?: number;
  deviceClass: DeviceClass;
}) {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { id: true, templateVersionId: true, status: true, expiresAt: true },
  });
  if (!event || event.status !== "active" || !event.templateVersionId) {
    return { error: "unavailable" as const };
  }
  if (event.expiresAt && event.expiresAt.getTime() < Date.now()) {
    return { error: "expired" as const };
  }

  await prisma.templateTelemetryEvent.create({
    data: {
      eventId: event.id,
      templateVersionId: event.templateVersionId,
      kind: params.kind,
      stepKey: params.stepKey,
      stepType: params.stepType,
      stepIndex: params.stepIndex,
      deviceClass: params.deviceClass,
    },
  });

  return { ok: true as const };
}

export async function getTemplateAnalytics(templateId: string) {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      versions: {
        select: { id: true, version: true, status: true },
        orderBy: { version: "desc" },
      },
    },
  });
  if (!template) return { error: "not_found" as const };

  const versionIds = template.versions.map((v) => v.id);
  const eventsUsing = await prisma.event.count({
    where: { templateId },
  });

  const unlockStats = await prisma.eventAccessLog.groupBy({
    by: ["success"],
    where: { event: { templateId } },
    _count: true,
  });
  const unlockSuccess = unlockStats.find((s) => s.success)?._count ?? 0;
  const unlockFail = unlockStats.find((s) => !s.success)?._count ?? 0;
  const unlockTotal = unlockSuccess + unlockFail;

  const telemetry =
    versionIds.length === 0
      ? []
      : await prisma.templateTelemetryEvent.groupBy({
          by: ["templateVersionId", "kind", "stepKey", "stepType", "deviceClass"],
          where: { templateVersionId: { in: versionIds } },
          _count: true,
        });

  const byVersion = template.versions.map((v) => {
    const rows = telemetry.filter((t) => t.templateVersionId === v.id);
    const stepStarts = rows.filter((r) => r.kind === "STEP_START");
    const stepCompletes = rows.filter((r) => r.kind === "STEP_COMPLETE");
    const flowComplete = rows
      .filter((r) => r.kind === "FLOW_COMPLETE")
      .reduce((s, r) => s + r._count, 0);

    const dropOff = stepStarts
      .map((start) => {
        const completed =
          stepCompletes.find(
            (c) => c.stepKey === start.stepKey && c.stepType === start.stepType,
          )?._count ?? 0;
        return {
          stepKey: start.stepKey,
          stepType: start.stepType,
          starts: start._count,
          completes: completed,
          dropOffRate:
            start._count === 0 ? 0 : Math.max(0, 1 - completed / start._count),
        };
      })
      .sort((a, b) => b.dropOffRate - a.dropOffRate)
      .slice(0, 5);

    const devices = ["MOBILE", "TABLET", "DESKTOP", "UNKNOWN"].map((d) => ({
      deviceClass: d,
      count: rows
        .filter((r) => r.deviceClass === d)
        .reduce((s, r) => s + r._count, 0),
    }));

    return {
      versionId: v.id,
      version: v.version,
      status: v.status,
      flowComplete,
      topDropOffSteps: dropOff,
      deviceSplit: devices,
      sampleSize: rows.reduce((s, r) => s + r._count, 0),
    };
  });

  return {
    templateId,
    usageCount: template.usageCount,
    eventsUsing,
    unlockSuccessRate: unlockTotal === 0 ? null : unlockSuccess / unlockTotal,
    unlockSuccess,
    unlockFail,
    versions: byVersion,
    note:
      byVersion.every((v) => v.sampleSize === 0)
        ? "ยังไม่มี telemetry จาก guest — ตัวเลข unlock มาจาก event_access_logs จริง"
        : null,
  };
}
