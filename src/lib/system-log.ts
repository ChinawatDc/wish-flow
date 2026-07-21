import type { Prisma, SystemLogLevel } from "@prisma/client";

import { prisma } from "@/lib/db";
import { sanitizeMetadata } from "@/lib/log-sanitize";

export type WriteSystemLogParams = {
  level?: SystemLogLevel;
  source: string;
  code: string;
  message: string;
  requestId?: string | null;
  route?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
  error?: unknown;
};

/** เขียน system log — ห้าม throw กลับไปหา caller ถ้า insert พัง */
export async function writeSystemLog(params: WriteSystemLogParams): Promise<void> {
  try {
    const err =
      params.error instanceof Error
        ? params.error
        : params.error
          ? new Error(String(params.error))
          : null;
    await prisma.systemLog.create({
      data: {
        level: params.level ?? "INFO",
        source: params.source,
        code: params.code,
        message: params.message.slice(0, 500),
        requestId: params.requestId ?? null,
        route: params.route ?? null,
        httpStatus: params.httpStatus ?? null,
        durationMs: params.durationMs ?? null,
        metadata: sanitizeMetadata(params.metadata ?? {}) as Prisma.InputJsonObject,
        errorName: err?.name ?? null,
        stackDigest: err?.stack ? err.stack.slice(0, 400) : null,
      },
    });
  } catch (insertError) {
    console.error("[system-log] insert failed", insertError);
  }
}
