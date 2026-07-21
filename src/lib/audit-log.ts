import type { AuditOutcome, Prisma } from "@prisma/client";

import type { AuditAction, AuditResourceType } from "@/lib/audit-actions";
import { prisma } from "@/lib/db";
import { sanitizeMetadata } from "@/lib/log-sanitize";
import { writeSystemLog } from "@/lib/system-log";

export type WriteAuditParams = {
  action: AuditAction;
  actor?: {
    userId?: string | null;
    role?: string | null;
    email?: string | null;
  } | null;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  outcome?: AuditOutcome;
  summaryTh: string;
  ipHash?: string | null;
  deviceId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * เขียน audit log แบบปลอดภัย — insert fail ต้องไม่ throw ไปพัง business flow
 * (แต่บันทึกความล้มเหลวลง system log แทน)
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorUserId: params.actor?.userId ?? null,
        actorRole: params.actor?.role ?? null,
        actorEmail: params.actor?.email ?? null,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        outcome: params.outcome ?? "SUCCESS",
        summaryTh: params.summaryTh.slice(0, 300),
        ipHash: params.ipHash ?? null,
        deviceId: params.deviceId ?? null,
        requestId: params.requestId ?? null,
        metadata: sanitizeMetadata(params.metadata ?? {}) as Prisma.InputJsonObject,
      },
    });
  } catch (error) {
    await writeSystemLog({
      level: "ERROR",
      source: "audit",
      code: "AUDIT_INSERT_FAILED",
      message: `เขียน audit ไม่สำเร็จ: ${params.action}`,
      metadata: { action: params.action, resourceType: params.resourceType },
      error,
    });
  }
}
