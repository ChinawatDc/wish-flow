# Wish-Flow

Micro-site builder สำหรับอีเวนต์อวยพร (เริ่มจาก HBD) — สร้างง่าย, แชร์ด้วย QR/ลิงก์, ปลดล็อกด้วย PIN

**Status:** Auth + RBAC (Admin / User / Guest) — การ์ดแยกตามบัญชีผู้ใช้

## Docs
1. [AGENTS.md](AGENTS.md)
2. [goal.md](goal.md)
3. [flow.md](flow.md)
4. [docs/system-design.md](docs/system-design.md)
5. [docs/adr.md](docs/adr.md) — architecture decisions + backup/restore + Auth
6. [docs/AI_BOOTSTRAP_PROMPT.md](docs/AI_BOOTSTRAP_PROMPT.md)
7. [docs/support-ops-milestones.md](docs/support-ops-milestones.md) — Account Security / Support / Chat / Logs (A→E)
8. [docs/AI_SUPPORT_OPS_PROMPT.md](docs/AI_SUPPORT_OPS_PROMPT.md) — คำสั่ง AI ทำทุก Milestone จนจบ

## Quick Start

```bash
cp .env.example .env   # ใส่ DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_EMAIL/PASSWORD
npm install
npx prisma migrate deploy
npm run db:seed        # templates + bootstrap admin
npm run dev
# http://localhost:3000
```

## Roles

| Role | สิทธิ์ |
|------|--------|
| **User** | สมัคร/ล็อกอิน, CRUD การ์ดของตัวเอง |
| **Admin** | CRUD การ์ดของตัวเอง + ดูการ์ดทุกใบ (read-only) + จัดการผู้ใช้ (ระงับ/เปลี่ยน role) |
| **Guest** | เปิดลิงก์/QR → กรอก PIN → ดูการ์ด (ไม่ใช่บัญชี) |

## Main routes

| Path | หน้าที่ |
|------|---------|
| `/login` `/register` | เข้าสู่ระบบ / สมัคร (อีเมลหรือ Google) |
| `/events` | การ์ดของฉัน (ต้อง login) |
| `/events/[id]/edit` | แก้ไขการ์ดตัวเอง |
| `/admin/users` | จัดการผู้ใช้ (Admin) |
| `/admin/events` | ดูการ์ดทั้งหมดแบบอ่านอย่างเดียว (Admin) |
| `/e/[id]` | Guest กรอก PIN |
| `/e/[id]/view` | เล่น StepRenderer |

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
