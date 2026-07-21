# Wish-Flow — Flows

User flows + ลำดับ implement ที่ agent ต้องตาม

---

## 1. Creator Flow

```
[หน้าแรก /]
  → กด "สร้างอีเวนต์"
  → กรอกชื่อ
  → ระบบ gen Event ID (UUID) + PIN 6 หลัก
  → แสดง PIN ครั้งเดียว (เตือนให้บันทึก)
  → หน้าตั้งค่า /events/:id/edit
       → เลือกวันที่
       → เลือก Template (+ preview)
       → กรอก fields ตาม steps_schema
       → บันทึก
  → หน้า List /events
       → ปุ่ม: ดู / แก้ไข / ลบ / QR
       → QR modal: QR image + link + copy
       → แสดง view_count
```

**Ownership:** บัญชีผู้ใช้ (`ownerUserId` จาก session) — ต้อง login ก่อนสร้าง/แก้การ์ด
การ์ดเดิมที่ผูก `wf_device_token` จะถูก claim เข้าบัญชีอัตโนมัติครั้งเดียวหลัง login (`POST /api/auth/claim-device`)

---

## 2. Guest Flow

```
สแกน QR หรือเปิด /e/:id
  → หน้ากรอก PIN (6 หลัก)
  → ถูก → ออก short-lived unlock cookie/JWT → /e/:id/view
       → StepRenderer เล่นตาม steps_schema + template_data
       → เพิ่ม view_count (ครั้งที่ unlock สำเร็จ)
  → ผิด → บันทึก event_access_logs
  → ผิดเกิน N ครั้ง / หน้าต่างเวลา → ล็อกชั่วคราว (429)
```

**อุปกรณ์:** mobile-first (QR จากมือถือเป็นหลัก), ใช้ได้บน tablet/desktop

---

## 3. Security Flow (ต้องมีใน MVP)

```
verify-pin:
  rate-limit(IP + eventId) → compare bcrypt(pin) → issue unlock token
view:
  require unlock token → return template_data (sanitize) จาก pinned template version
creator mutations:
  require session (Auth.js JWT) && event.ownerUserId === session.user.id
admin:
  require role === ADMIN — ดูการ์ดทุกใบ read-only, จัดการ users, จัดการ Template Studio
  ห้าม mutate การ์ดของ user คนอื่น
```

**Roles:** `USER` / `ADMIN` (ตาราง `users`) + Guest (PIN, ไม่ใช่บัญชี) — ดู `docs/adr.md` ADR-4

---

## 4. Implementation Order (ห้ามสลับ)

1. Docker Compose Postgres + `.env`
2. Prisma schema ตาม `docs/system-design.md` §5 + migrate + seed template แรก
3. Lib: pin hash/verify, device_token, rate limit (Redis optional — MVP ใช้ DB logs ได้ก่อน)
4. API: events CRUD, templates list, regenerate-pin, verify-pin, view
5. UI creator: list / create / edit / QR modal (responsive)
6. UI guest: PIN gate + StepRenderer (responsive)
7. Tests: unit (pin, schema validation) + API integration กับ Postgres จริง
8. Polish animation (Framer/Lottie) หลัง e2e เขียว

---

## 5. API Map

| Method | Path | หมายเหตุ |
|--------|------|----------|
| POST | `/api/events` | สร้าง — return `{ id, pin }` (pin โชว์ครั้งเดียว) |
| GET | `/api/events` | list ของ creator |
| GET | `/api/events/:id` | รายละเอียด admin (+assets, +unlock stats) |
| PATCH | `/api/events/:id` | แก้ไข (name, dates, template, data, status draft/active) |
| DELETE | `/api/events/:id` | ลบ (ลบไฟล์รูปใน storage ด้วย) |
| POST | `/api/events/:id/regenerate-pin` | PIN ใหม่ |
| POST | `/api/events/:id/duplicate` | ทำสำเนา event (PIN ใหม่, status draft) |
| GET | `/api/events/:id/assets` | list รูปของ event |
| POST | `/api/events/:id/assets` | อัปโหลดรูป (multipart, ≤5MB, JPG/PNG/WebP) |
| DELETE | `/api/events/:id/assets/:assetId` | ลบรูป (storage + DB) |
| POST | `/api/events/:id/assets/reorder` | เปลี่ยนลำดับรูป |
| GET | `/api/uploads/[...path]` | เสิร์ฟไฟล์รูป (กัน path traversal) |
| GET | `/api/templates?q=&category=&hasGame=&premium=&mood=&page=&limit=&sort=` | ค้นหา/filter/pagination (limit ≤24) |
| GET | `/api/templates/:slug` | รายละเอียดเทมเพลต |
| GET | `/api/templates/:slug/preview` | ข้อมูลตัวอย่างสำหรับ preview (ไม่แตะ event จริง) |
| POST | `/api/e/:id/verify-pin` | guest unlock (rate-limited) |
| POST | `/api/e/:id/public-enter` | PUBLIC mode: ออก unlock cookie โดยไม่ใช้ PIN |
| GET | `/api/e/:id/view` | ต้องมี unlock token (+assets) — schema จาก pinned version |
| POST | `/api/e/:id/telemetry` | guest funnel telemetry (ต้องมี unlock token) |
| GET | `/api/e/:id/guestbook` | public meta (access mode / canSubmit) |
| POST | `/api/e/:id/guestbook/submit` | multipart คำอวยพร (+รูป optional); rate limit 5/ชม. |
| GET | `/api/e/:id/guestbook/wall` | กำแพง APPROVED เท่านั้น (cursor pagination) |
| GET | `/api/e/:id/guestbook/photos/:entryId` | proxy รูป APPROVED |
| GET | `/api/events/:id/guestbook` | เจ้าของ: list + counters + filter/pagination |
| PATCH/DELETE | `/api/events/:id/guestbook/:entryId` | เจ้าของ: moderate / ลบ |
| POST | `/api/events/:id/guestbook/bulk` | เจ้าของ: bulk ≤50 |
| GET | `/api/events/:id/guestbook/photos/:entryId` | เจ้าของ: proxy รูปทุกสถานะ |
| POST | `/api/auth/register` | สมัครด้วยอีเมล/รหัสผ่าน |
| GET/POST | `/api/auth/[...nextauth]` | Auth.js (Credentials + Google) |
| POST | `/api/auth/claim-device` | claim การ์ด legacy จาก device cookie ครั้งเดียวหลัง login |
| GET | `/api/admin/users` | Admin: list/search ผู้ใช้ (`role`, `status`, `q`, `page`, `limit` เริ่มต้น 10) |
| PATCH | `/api/admin/users/:id` | Admin: suspend/reactivate, เปลี่ยน role (กัน demote/suspend ตัวเอง + last-admin) |
| GET | `/api/admin/events` | Admin: การ์ดทุกบัญชี read-only (ไม่มี pinHash) |
| GET | `/api/admin/events/:id` | Admin: รายละเอียดการ์ด read-only |
| POST | `/api/events/:id/share` | เจ้าของ: เผยแพร่ snapshot ไปคลังแชร์ (opt-in รวมรูป) |
| POST | `/api/events/:id/share/unpublish` | เจ้าของ: เลิกเผยแพร่ (UNLISTED) |
| GET | `/api/events/:id/share/revisions` | เจ้าของ: ประวัติเวอร์ชันที่เคยแชร์ |
| GET | `/api/marketplace/cards` | คลังแชร์ (login) — list LISTED |
| GET | `/api/marketplace/cards/:id` | รายละเอียด + พรีวิว snapshot |
| POST | `/api/marketplace/cards/:id/heart` | กด/ยกเลิกหัวใจ (unique ต่อ user) |
| POST | `/api/marketplace/cards/:id/use` | นำไปใช้ → draft ของผู้ใช้ + PIN ใหม่ (นับ unique) |
| GET/POST | `/api/admin/templates` | Admin: Template Studio list/create draft |
| GET/PATCH | `/api/admin/templates/:id` | Admin: metadata + draft editing |
| POST | `/api/admin/templates/:id/validate` | ตรวจ schema/sample/QA gate |
| POST | `/api/admin/templates/:id/publish` | publish (immutable, ต้องมี release notes) |
| POST | `/api/admin/templates/:id/duplicate` | ทำสำเนาเป็น draft ใหม่ |
| GET | `/api/admin/templates/:id/versions` | ประวัติ version |
| POST | `/api/admin/templates/:id/rollback` | rollback = publish clone version ใหม่ |
| GET/POST | `/api/admin/templates/:id/assets` | template assets (StorageAdapter) |
| GET | `/api/admin/templates/:id/analytics` | usage/unlock/drop-off จากข้อมูลจริง |
| GET/PATCH | `/api/me/profile` | โปรไฟล์ (name, username, phone — อีเมล read-only) |
| POST | `/api/me/change-password` | เปลี่ยนรหัสผ่าน (bump authVersion → re-login) |
| POST | `/api/me/set-password` | ตั้งรหัสผ่านครั้งแรก (บัญชี OAuth) |
| POST/PATCH | `/api/me/security-pin` | ตั้ง/เปลี่ยน Security PIN ของบัญชี (lockout 5/15 นาที) |
| GET | `/api/me/security-status` | สถานะ hasPin / mustChange* (สำหรับ modal) |
| GET/PATCH | `/api/me/notifications` | in-app notifications + mark all read |
| POST | `/api/admin/step-up/verify-pin` | ยืนยัน Security PIN → step-up cookie 5 นาที |
| POST | `/api/admin/users/:id/reset-password` | ต้อง step-up; temp password โชว์ครั้งเดียว (self-reset ถูกบล็อก) |
| POST | `/api/admin/users/:id/reset-security-pin` | ต้อง step-up; temp PIN โชว์ครั้งเดียว |
| POST | `/api/support/contact` | public เปิดเคส (rate limit ip/device + captcha stub) — token โชว์ครั้งเดียว |
| GET | `/api/support/cases/:id?token=` | ติดตามเคสด้วย token (IP อย่างเดียวเปิดไม่ได้) |
| POST | `/api/support/cases/:id/messages` | ผู้แจ้งตอบเพิ่มผ่าน token |
| GET | `/api/admin/support/cases` | Admin: list/filter เคส |
| GET/PATCH | `/api/admin/support/cases/:id` | Admin: รายละเอียด + สถานะ/priority/assign |
| POST | `/api/admin/support/cases/:id/claim` | รับเคส (กันรับซ้ำ) |
| POST | `/api/admin/support/cases/:id/messages` | ตอบผู้แจ้ง (PUBLIC) / โน้ตภายใน (INTERNAL) |
| GET/POST | `/api/support/conversations` | user get-or-create ห้องแชทของตัวเอง (1 user = 1 ห้อง) |
| GET/POST | `/api/support/conversations/:id/messages` | user อ่าน/ส่ง (INTERNAL ถูกซ่อน, admin = 「เจ้าหน้าที่」) |
| GET | `/api/admin/inbox` | Admin: ทุก conversation + unread |
| GET/POST | `/api/admin/inbox/:id/messages` | Admin: อ่าน (รวม INTERNAL + ชื่อจริง) / ตอบ |
| GET | `/api/admin/logs/audit` | Admin: audit log (filter action/actor/outcome/ช่วงเวลา) |
| GET | `/api/admin/logs/system` | Admin: system log (filter level/source/code) |
| POST | `/api/admin/logs/export` | Admin: export CSV/JSON (audit การ export ด้วย) |

---

## 6. Template System (Lego)

Template = config ล้วน (`steps_schema` JSON) ประกอบจาก step types ใน registry
(`src/components/steps/StepRenderer.tsx`) — เพิ่ม template ใหม่ = เพิ่มใน `prisma/seed.ts` เท่านั้น

### Step types ที่รองรับ (21 แบบ)

| กลุ่ม | Types |
|-------|-------|
| ข้อความ/เอฟเฟกต์ | `gift-box`, `text-reveal`, `typewriter-message`, `envelope-open`, `countdown`, `candle-blow`, `final-celebration` |
| รูปภาพ | `photo-reveal`, `photo-polaroid`, `photo-slideshow`, `photo-collage`, `memory-timeline`, `scratch-card`, `puzzle-photo` |
| มินิเกม | `tap-the-balloon`, `catch-the-heart`, `memory-match`, `birthday-quiz`, `spin-the-wheel`, `find-the-gift`, `confetti-pop` |

กติกามินิเกม: เล่นได้ทั้ง touch/mouse, มีปุ่มข้ามทุกเกม, ไม่บังคับเสียง,
รองรับ `prefers-reduced-motion`, ไม่ใช่ security gate, มี fallback emoji เมื่อไม่มีรูป

### ตัวอย่าง steps_schema

```json
{
  "steps": [
    { "key": "opening", "type": "gift-box", "fields": ["title_text"] },
    { "key": "message", "type": "text-reveal", "fields": ["message_text", "sender_name"] },
    { "key": "cake", "type": "candle-blow", "fields": ["cake_style"] }
  ]
}
```

Seed ปัจจุบันมี **13 templates** ครอบคลุม 7 หมวด (วันเกิด, รูปภาพ, มินิเกม, โรแมนติก, เพื่อน, ครอบครัว, เรียบง่าย)
