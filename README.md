# Wish-Flow

Micro-site builder สำหรับอีเวนต์อวยพร (เริ่มจาก HBD) — สร้างง่าย, แชร์ด้วย QR/ลิงก์, ปลดล็อกด้วย PIN

**Status:** Phase 2 enhancement complete — ปฏิทิน พ.ศ., อัปโหลดรูป, Template Explorer, 21 step types, 13 templates

## Docs
1. [AGENTS.md](AGENTS.md)
2. [goal.md](goal.md)
3. [flow.md](flow.md)
4. [docs/system-design.md](docs/system-design.md)
5. [docs/adr.md](docs/adr.md) — architecture decisions + backup/restore
6. [docs/AI_BOOTSTRAP_PROMPT.md](docs/AI_BOOTSTRAP_PROMPT.md)

## Quick Start

```bash
npm run db:up
cp .env.example .env   # ครั้งแรก
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
# http://localhost:3000
```

## Test

```bash
npm test          # unit + Postgres integration (ต้อง db:up ก่อน)
npm run build
```

## Main routes

| Path | หน้าที่ |
|------|---------|
| `/` | Landing |
| `/events` | List / สร้าง / สำเนา event + QR |
| `/events/[id]/edit` | แก้ไข 4 ส่วน (ข้อมูล + รูป + เทมเพลต + เนื้อหา) autosave + preview |
| `/e/[id]` | Guest กรอก PIN (numpad) |
| `/e/[id]/view` | เล่น StepRenderer (21 step types) |

## Features หลัก

- 📅 ปฏิทิน พ.ศ. (แสดง `21-07-2569`, เก็บ DB เป็น ISO)
- 📸 อัปโหลดรูป ≤5MB (JPG/PNG/WebP, ตรวจ magic bytes, ชื่อไฟล์ UUID, storage adapter สลับ cloud ได้)
- 🎨 Template Explorer: ค้นหา/หมวดหมู่/filter/sort + pagination + preview ก่อนเลือก
- 🎮 มินิเกม 7 แบบ + step รูปภาพ 7 แบบ — template ใหม่สร้างจาก config ใน seed
- 📝 Draft/publish, วันหมดอายุ, duplicate, สถิติ unlock

## Maintenance

```bash
npx tsx scripts/cleanup-orphan-assets.ts --dry-run   # หาไฟล์ orphan
# backup/restore: ดู docs/adr.md
```

## Stack
Next.js 15 · Prisma · PostgreSQL 16 (Docker `:5435`) · Vitest
# wish-flow
