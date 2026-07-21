/**
 * Audit cleanup: ลบไฟล์ใน uploads/ ที่ไม่มี record ใน event_assets / guestbook_entries
 * รัน: npx tsx scripts/cleanup-orphan-assets.ts [--dry-run]
 */
import { readdir, unlink } from "fs/promises";
import path from "path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const dryRun = process.argv.includes("--dry-run");

async function sweepDir(
  subdir: string,
  known: Set<string>,
): Promise<number> {
  const root = path.join(UPLOAD_ROOT, subdir);
  let ownerDirs: string[] = [];
  try {
    ownerDirs = await readdir(root);
  } catch {
    return 0;
  }

  let removed = 0;
  for (const ownerId of ownerDirs) {
    const dir = path.join(root, ownerId);
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      const rel = `${subdir}/${ownerId}/${file}`;
      if (!known.has(rel)) {
        console.log(`${dryRun ? "[dry-run] " : ""}orphan: ${rel}`);
        if (!dryRun) await unlink(path.join(dir, file));
        removed++;
      }
    }
  }
  return removed;
}

async function main() {
  const [assets, guestbook] = await Promise.all([
    prisma.eventAsset.findMany({ select: { url: true } }),
    prisma.guestbookEntry.findMany({
      where: { photoUrl: { not: null } },
      select: { photoUrl: true },
    }),
  ]);

  const known = new Set(
    [...assets.map((a) => a.url), ...guestbook.map((g) => g.photoUrl!)]
      .map((u) => u.replace(/^\/api\/uploads\//, "")),
  );

  const removedEvents = await sweepDir("events", known);
  const removedGuestbook = await sweepDir("guestbook", known);
  const removed = removedEvents + removedGuestbook;

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
