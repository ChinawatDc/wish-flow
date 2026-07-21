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

**Ownership:** cookie `device_token` — ไม่บังคับสมัครสมาชิก

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
  require unlock token → return template_data (sanitize)
creator mutations:
  require device_token matches event.creator
```

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
| GET | `/api/e/:id/view` | ต้องมี unlock token (+assets) |

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
