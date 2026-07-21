/**
 * Support privacy retention — ล้าง ipHash / deviceId / userAgentDigest
 * ของเคสที่ปิดแล้ว (CLOSED/SPAM/RESOLVED) เกิน 30 วัน — รันซ้ำได้
 *
 * ไม่ลบตัวเคส/ข้อความ (เก็บไว้เป็นประวัติ) — ลบเฉพาะ metadata ระบุตัวตนชั่วคราว
 * ไม่เก็บ MAC address ตั้งแต่ต้น และ token เก็บเป็น hash เท่านั้น
 *
 * วิธีรัน:
 *   npx tsx scripts/cleanup-support-retention.ts --dry-run
 *   npx tsx scripts/cleanup-support-retention.ts
 */
import { PrismaClient } from "@prisma/client";

const PRIVACY_RETENTION_DAYS = 30;

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`[cleanup-support] mode=${dryRun ? "DRY-RUN" : "SCRUB"}`);

  const cutoff = new Date(Date.now() - PRIVACY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const where = {
    status: { in: ["CLOSED", "SPAM", "RESOLVED"] as ("CLOSED" | "SPAM" | "RESOLVED")[] },
    updatedAt: { lt: cutoff },
    OR: [
      { ipHash: { not: null } },
      { deviceId: { not: null } },
      { userAgentDigest: { not: null } },
    ],
  };

  const count = await prisma.supportCase.count({ where });
  console.log(
    `cases closed > ${PRIVACY_RETENTION_DAYS}d with privacy metadata: ${count}`,
  );

  if (dryRun) {
    console.log("[cleanup-support] dry-run — ไม่แก้ข้อมูล");
    return;
  }

  const result = await prisma.supportCase.updateMany({
    where,
    data: { ipHash: null, deviceId: null, userAgentDigest: null },
  });
  console.log(`[cleanup-support] scrubbed ${result.count} cases`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
