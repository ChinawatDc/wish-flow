/**
 * Log retention cleanup — รันซ้ำได้ (idempotent)
 *
 * นโยบาย:
 *   - AuditLog: เก็บ 365 วัน
 *   - SystemLog ERROR/FATAL: เก็บ 180 วัน
 *   - SystemLog DEBUG/INFO/WARN: เก็บ 30 วัน
 *
 * วิธีรัน:
 *   npx tsx scripts/cleanup-logs.ts --dry-run   # ดูจำนวนที่จะลบ (ไม่ลบจริง)
 *   npx tsx scripts/cleanup-logs.ts             # ลบจริง
 */
import { PrismaClient } from "@prisma/client";

const AUDIT_RETENTION_DAYS = 365;
const SYSTEM_ERROR_RETENTION_DAYS = 180;
const SYSTEM_INFO_RETENTION_DAYS = 30;

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log(`[cleanup-logs] mode=${dryRun ? "DRY-RUN" : "DELETE"}`);

  const auditCutoff = daysAgo(AUDIT_RETENTION_DAYS);
  const errorCutoff = daysAgo(SYSTEM_ERROR_RETENTION_DAYS);
  const infoCutoff = daysAgo(SYSTEM_INFO_RETENTION_DAYS);

  const auditWhere = { occurredAt: { lt: auditCutoff } };
  const systemErrorWhere = {
    occurredAt: { lt: errorCutoff },
    level: { in: ["ERROR", "FATAL"] as ("ERROR" | "FATAL")[] },
  };
  const systemInfoWhere = {
    occurredAt: { lt: infoCutoff },
    level: { in: ["DEBUG", "INFO", "WARN"] as ("DEBUG" | "INFO" | "WARN")[] },
  };

  const [auditCount, sysErrCount, sysInfoCount] = await Promise.all([
    prisma.auditLog.count({ where: auditWhere }),
    prisma.systemLog.count({ where: systemErrorWhere }),
    prisma.systemLog.count({ where: systemInfoWhere }),
  ]);

  console.log(`audit logs older than ${AUDIT_RETENTION_DAYS}d: ${auditCount}`);
  console.log(`system ERROR/FATAL older than ${SYSTEM_ERROR_RETENTION_DAYS}d: ${sysErrCount}`);
  console.log(`system DEBUG/INFO/WARN older than ${SYSTEM_INFO_RETENTION_DAYS}d: ${sysInfoCount}`);

  if (dryRun) {
    console.log("[cleanup-logs] dry-run — ไม่ลบข้อมูล");
    return;
  }

  const [a, se, si] = await Promise.all([
    prisma.auditLog.deleteMany({ where: auditWhere }),
    prisma.systemLog.deleteMany({ where: systemErrorWhere }),
    prisma.systemLog.deleteMany({ where: systemInfoWhere }),
  ]);
  console.log(`[cleanup-logs] deleted audit=${a.count} systemError=${se.count} systemInfo=${si.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
