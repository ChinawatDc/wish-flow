/**
 * Audit cleanup: ลบไฟล์ใน uploads/ ที่ไม่มี record ใน event_assets แล้ว (orphan)
 * รัน: npx tsx scripts/cleanup-orphan-assets.ts [--dry-run]
 */
import { readdir, unlink } from "fs/promises";
import path from "path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const assets = await prisma.eventAsset.findMany({ select: { url: true } });
  const known = new Set(
    assets.map((a) => a.url.replace(/^\/api\/uploads\//, "")),
  );

  const eventsDir = path.join(UPLOAD_ROOT, "events");
  let eventDirs: string[] = [];
  try {
    eventDirs = await readdir(eventsDir);
  } catch {
    console.log("ไม่มีโฟลเดอร์ uploads/events — ไม่มีอะไรให้ล้าง");
    return;
  }

  let removed = 0;
  for (const eventId of eventDirs) {
    const dir = path.join(eventsDir, eventId);
    const files = await readdir(dir);
    for (const file of files) {
      const rel = `events/${eventId}/${file}`;
      if (!known.has(rel)) {
        console.log(`${dryRun ? "[dry-run] " : ""}orphan: ${rel}`);
        if (!dryRun) await unlink(path.join(dir, file));
        removed++;
      }
    }
  }
  console.log(
    `${dryRun ? "พบ" : "ลบ"} orphan ${removed} ไฟล์ (DB มี ${known.size} รูป)`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
