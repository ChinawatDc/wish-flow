# Architecture Decisions — Wish-Flow

## ADR-1: UI Library สำหรับปฏิทินและ component

**ตัดสินใจ:** ไม่ใช้ MUI/Ant Design — เขียน component เองด้วย TailwindCSS (แนวเดียวกับ shadcn/ui คือ copy-in component ที่เราคุมโค้ดเองทั้งหมด)

**เหตุผล:**
- MUI/Ant มาพร้อม design language ของตัวเอง ปรับให้เข้าธีมการ์ตูนพาสเทล + ฟอนต์ Mali ต้อง override เยอะ และเพิ่ม bundle size มาก
- ปฏิทิน พ.ศ. ต้อง custom ลึก (ปีใน dropdown, caption, format) — เขียนเองตรงไปตรงมากว่า
- `ThaiDatePicker` ของเราเป็น dependency-free, ~200 บรรทัด, คุมได้ 100%

**ผลที่ตามมา:** ถ้าภายหลังต้องการ date-range หรือ features ซับซ้อน ค่อยพิจารณา `react-day-picker` v9 (custom formatters รองรับ พ.ศ. ได้)

## ADR-2: Buddhist calendar — แปลงเฉพาะชั้น UI

**ตัดสินใจ:** ฐานข้อมูล + API ทั้งหมดใช้ ISO/Gregorian (`2026-07-21`) — แปลงเป็น พ.ศ. (`21-07-2569`) เฉพาะตอนแสดงผล ผ่าน `src/lib/thai-date.ts`

**เหตุผล:**
- Date ใน DB ต้อง sort/filter/compare ได้มาตรฐาน
- พ.ศ. = ค.ศ. + 543 เป็น presentation concern ล้วนๆ
- ถ้าเก็บ พ.ศ. ใน DB จะเกิด bug ทุกครั้งที่ integrate กับระบบอื่น

**การทดสอบ:** unit test แปลงไปกลับ, leap year, format ผิด ครอบคลุมใน `thai-date.test.ts`

## ADR-3: Storage adapter สำหรับรูปภาพ

**ตัดสินใจ:** interface `StorageAdapter` (`save` / `delete` / `read`) ใน `src/lib/storage.ts` — MVP ใช้ `LocalStorageAdapter` เก็บที่ `uploads/events/<eventId>/<uuid>.<ext>` เสิร์ฟผ่าน route `/api/uploads/[...path]`

**เหตุผล:**
- ห้ามเก็บ binary ใน PostgreSQL (ทำ DB บวม, backup ช้า) — DB เก็บเฉพาะ metadata ใน `event_assets`
- เสิร์ฟผ่าน route (ไม่ใช่ `public/`) เพราะ production build ของ Next ไม่เห็นไฟล์ที่อัปโหลดหลัง build และเราคุม Content-Type/Cache ได้
- เปลี่ยนเป็น Supabase Storage / Cloudflare R2 = เขียน adapter ใหม่ตัวเดียว จุดเรียกที่เหลือไม่ต้องแก้

**Security:** ตั้งชื่อไฟล์ใหม่ด้วย UUID, ตรวจ magic bytes + MIME + นามสกุล + ขนาด ≤5MB ฝั่ง server, กัน path traversal ใน `urlToSafePath`

## Backup / Restore

### PostgreSQL

```bash
# backup
docker exec wishflow-postgres pg_dump -U wishflow wish_flow > backup-$(date +%Y%m%d).sql

# restore
docker exec -i wishflow-postgres psql -U wishflow wish_flow < backup-YYYYMMDD.sql
```

### Assets (uploads/)

```bash
# backup
tar czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# restore
tar xzf uploads-backup-YYYYMMDD.tar.gz
```

ควร backup ทั้งสองอย่างพร้อมกันเสมอ (DB อ้างอิง URL ของไฟล์)

## ADR-4: Auth.js + RBAC (Admin / User / Guest)

**ตัดสินใจ:** ใช้ Auth.js (next-auth v5) + Prisma adapter, session แบบ JWT, รองรับ Credentials (email/password) และ Google OAuth

**บทบาท:**
- `USER` / `ADMIN` = บัญชีในตาราง `users` — CRUD เฉพาะการ์ดที่ `owner_user_id` เป็นของตัวเอง
- `GUEST` = ไม่ใช่บัญชี — เปิดการ์ดด้วย PIN + unlock JWT เหมือนเดิม
- `ADMIN` ดูการ์ดทุกใบแบบ read-only ผ่าน `/api/admin/events*` และจัดการสถานะ/role ผู้ใช้ได้ — **ห้าม** mutate การ์ดของ user คนอื่น

**Claim การ์ดเดิม:** หลัง login, `POST /api/auth/claim-device` ย้าย event ที่ยัง `owner_user_id IS NULL` จาก `wf_device_token` เข้าบัญชีครั้งเดียว

**Edge:** JWT callback ไม่เรียก Prisma ใน middleware (โหลด role/status ตอน sign-in เท่านั้น)

## ADR-5: Template Version Pinning (Template Studio)

**ตัดสินใจ:**
1. `TemplateVersion` แยกจาก catalog `Template` — published snapshot immutable
2. `Event.templateVersionId` pin กับ published version ที่เลือกตอนสร้าง/เปลี่ยนเทมเพลต — guest runtime อ่าน schema จาก pin เท่านั้น
3. `Template.stepsSchema` เป็น denormalized cache ของ current published เท่านั้น ห้ามเป็นแหล่ง guest render
4. Publish = สร้าง/promote version ใหม่ใน transaction แล้วอัปเดต `currentPublishedVersionId` — ไม่ UPDATE `steps_schema` ของ published row
5. Rollback = publish clone จาก historical snapshot เป็น version ใหม่
6. Milestone A: Admin (`USER.role = ADMIN`) เป็นคนเดียวที่ publish ได้ — ยังไม่สร้าง Designer/Reviewer roles
7. Seed upsert metadata ได้ แต่ห้าม overwrite published schema; ถ้า seed ต่างจาก published ให้สร้าง draft ใหม่แทน
8. Hard-delete template/version ที่ถูก pin ห้าม — ใช้ deprecate/archive

**เหตุผล:** เกณฑ์ IA #2 — existing live events ต้องไม่พังเมื่อ publish version ใหม่

**ผลที่ตามมา:**
- Catalog API คืน current published; creator GET/guest view คืน pinned version
- `duplicate` ต้อง copy ทั้ง `templateId` และ `templateVersionId`
- FK `template_version_id` เป็น `ON DELETE RESTRICT`

## ADR-6: Audit Log + System Log + Account Security (G7)

**ตัดสินใจ:**
1. แยก **AuditLog** (ใครทำอะไรกับใคร — security/สิทธิ์) จาก **SystemLog** (API error / job / ops) — คนละตารางกับ `event_access_logs` (rate limit unlock) และ `template_telemetry_events` (guest funnel)
2. เขียนผ่าน wrapper กลางเท่านั้น: `writeAudit()` / `writeSystemLog()` (`src/lib/audit-log.ts`, `src/lib/system-log.ts`) — insert fail ห้าม throw ทับ business error (audit fail → ลง system log แทน)
3. `action` มาจาก catalog กลาง `src/lib/audit-actions.ts` — ห้ามพิมพ์ string สดใน service
4. `metadata` ผ่าน `sanitizeMetadata()` เสมอ — ตัด key password/pin/token/secret/authorization/cookie/credential (nested) — **ห้ามมี secret ใน log ทุกชนิด**
5. IP/UA เก็บเป็น hash + pepper (`src/lib/privacy-hash.ts`, pepper จาก `AUTH_SECRET`) — ไม่เก็บ IP ดิบ/MAC
6. **Security PIN ของบัญชี ≠ Event PIN ของการ์ด** — PIN บัญชีอยู่ที่ `users.security_pin_hash` (bcrypt, lockout 5 ครั้ง/15 นาที), Event PIN อยู่ที่ `events.pin_hash` เหมือนเดิม ห้ามแตะ
7. Step-up: action อ่อนไหวของ admin (reset password/PIN ของ user อื่น) ต้องยืนยัน Security PIN ก่อน → JWT cookie `wf_admin_step_up` อายุ 5 นาที (HS256, secret เดียวกับ unlock) — API คืน 428 เมื่อไม่มี step-up
8. ค่า reset ชั่วคราวสุ่มจาก `crypto.randomBytes` เก็บเฉพาะ hash โชว์ครั้งเดียวใน response (`Cache-Control: no-store`) + ตั้ง `mustChange*` + bump `authVersion` (JWT เก่าใช้ไม่ได้ — `requireUser` re-check จาก DB)
9. Admin reset ตัวเองผ่าน admin console ถูกบล็อก (audit outcome DENIED) — ใช้หน้า `/profile` แทน
10. Public support case: token 32 bytes เก็บ sha256 ใน DB — เปิดเคสต้องมี token เท่านั้น; retention 30 วันหลังปิดเคสล้าง ipHash/deviceId/uaDigest (`scripts/cleanup-support-retention.ts`)
11. Log retention: audit 365 วัน; system ERROR/FATAL 180 วัน; DEBUG/INFO/WARN 30 วัน (`scripts/cleanup-logs.ts` — รองรับ `--dry-run`)
12. Realtime chat: persistence ลง Postgres ก่อนเสมอ + polling 4s fallback — Ably/Pusher เลื่อนจนมี keys (ดู goal.md § Blocked); ห้ามใช้ Socket.IO เป็นทางหลักบน Vercel serverless
13. hash chain (`prevHash`/`entryHash`) ของ audit — **เลื่อน** รอบนี้เพื่อความเรียบง่าย (ตารางออกแบบให้เพิ่มคอลัมน์ได้ภายหลัง)

**เหตุผล:** แยก concern ของ log ให้ query/retention ต่างกันได้, ลดความเสี่ยง secret รั่วผ่าน log, และให้ session revoke ทำงานได้จริงบน JWT (ADR-4) ผ่าน authVersion
