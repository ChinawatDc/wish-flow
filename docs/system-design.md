# ระบบเว็บอวยพรวันเกิด (HBD Event System)
## System Design Document — เริ่มจาก 0

---

## 1. ภาพรวมระบบ (What are we building?)

ระบบให้คนสร้าง "อีเวนต์อวยพรวันเกิด" แบบมี Template สวยๆ ให้เลือก แล้วแชร์ผ่าน QR/ลิงก์ พร้อมระบบ PIN ป้องกันคนแปลกหน้าเข้ามาดู

**Core value:** สร้างง่าย (ไม่ต้องสมัครสมาชิก) → แชร์ง่าย (QR/ลิงก์) → ปลอดภัยพอประมาณ (PIN) → ดูแล้วประทับใจ (Template สวย มี animation)

ถ้ามองเผื่ออนาคต ระบบนี้จริงๆ แล้วคือ **"Micro-site Builder as a Service"** — วันนี้ใช้กับ HBD วันหน้าอาจขยายเป็นการ์ดแต่งงาน, ขอบคุณลูกค้า, ขอโทษ, ขอแต่งงาน ฯลฯ ก็ได้ ถ้าออกแบบ template system ให้ยืดหยุ่นตั้งแต่ต้น จะต่อยอดง่ายมาก

---

## 2. Requirement เริ่มจาก 0 (ต้องมีอะไรบ้าง)

### 2.1 Functional Requirements

**ฝั่งผู้สร้าง (Creator / Admin)**
| # | Requirement |
|---|---|
| F1 | สร้างอีเวนต์ใหม่ (ตั้งชื่อ) |
| F2 | ระบบ gen Event ID (unique) และ PIN 6 หลัก อัตโนมัติ |
| F3 | ดูรายการอีเวนต์ที่ตัวเองสร้าง (List) |
| F4 | แก้ไขอีเวนต์ (ชื่อ, วันที่, template, เนื้อหา) |
| F5 | ลบอีเวนต์ |
| F6 | เลือก Template ที่ต้องการใช้ พร้อม preview |
| F7 | กรอกเนื้อหาแต่ละ step ของ template (ข้อความ, รูป, เพลง ฯลฯ) |
| F8 | Generate QR Code + ลิงก์ ของอีเวนต์ (modal แสดง QR + copy link) |
| F9 | ตั้ง/เปลี่ยน PIN ใหม่ได้ |
| F10 | เห็นสถานะ เช่น มีคนเปิดดูแล้วกี่ครั้ง (analytics เบื้องต้น) |

**ฝั่งผู้รับ (Guest)**
| # | Requirement |
|---|---|
| G1 | เข้าลิงก์ หรือสแกน QR |
| G2 | กรอก PIN 6 หลักเพื่อปลดล็อก |
| G3 | ดูโมเดล HBD ตาม step ที่ผู้สร้างตั้งไว้ |
| G4 | (เผื่ออนาคต) กดส่งข้อความ/หัวใจ ตอบกลับได้ |

### 2.2 Non-Functional Requirements (สิ่งที่มักถูกลืมตอนเริ่ม แต่สำคัญมากถ้าจะทำระบบใหญ่)

- **Security:** PIN ต้อง hash ไม่เก็บ plain text, ป้องกัน brute-force เดา PIN (rate limit)
- **Performance:** หน้า guest ต้องโหลดไว (เพราะเปิดจากมือถือ ผ่าน QR ส่วนใหญ่)
- **Scalability:** เพิ่ม Template ใหม่ได้โดยไม่ต้องแก้ schema/deploy ใหญ่
- **Extensibility:** วันหน้าขยายเป็น event ประเภทอื่นได้ (ไม่ผูกกับ "birthday" ตรงๆ)
- **Data ownership:** ผู้สร้างต้องแก้ไข/ลบ event ของตัวเองได้แม้ไม่ได้ login
- **Availability:** เว็บ static-heavy พอ deploy บน edge/CDN ได้เพื่อความเร็ว

---

## 3. User Flow

### 3.1 Flow ฝั่งผู้สร้าง
```
[หน้าแรก] → กด "สร้างอีเวนต์"
   → กรอกชื่ออีเวนต์
   → ระบบ gen Event ID + PIN 6 หลัก
   → พาไปหน้า "ตั้งค่าอีเวนต์"
        → เลือกวันที่
        → เลือก Template (พร้อม preview ตัวอย่าง)
        → กรอกข้อมูลแต่ละ Step ตาม Template ที่เลือก
        → บันทึก
   → กลับมาหน้า List
        → เห็น event ใหม่ในลิสต์ (พร้อมข้อมูล preview)
        → ปุ่ม: ดู / แก้ไข / ลบ / QR
        → กด QR → modal เปิด QR + ลิงก์ + ปุ่ม copy
```

### 3.2 Flow ฝั่งผู้รับ
```
สแกน QR หรือกดลิงก์
   → หน้า "กรอก PIN"
   → กรอกถูก → เข้าโมเดล HBD (เล่นตาม step ที่ตั้งไว้)
   → กรอกผิดเกิน N ครั้ง → ล็อกชั่วคราว (กัน brute-force)
```

---

## 4. Tech Stack

| Layer | เทคโนโลยี | เหตุผล |
|---|---|---|
| Frontend + Backend | **Next.js (App Router, TypeScript)** | ใช้ตัวเดียวคุมทั้ง UI และ API ได้ ลด complexity ตอนเริ่ม |
| Styling | **TailwindCSS + shadcn/ui** | ทำ UI ฝั่ง admin ได้เร็ว, component สวยพร้อมใช้ |
| Animation | **Framer Motion + Lottie** | จำเป็นสำหรับความ "น่ารัก" ของโมเดล HBD |
| ORM | **Prisma** | Type-safe, migrate DB ง่าย, generate client อัตโนมัติ |
| Database | **PostgreSQL** (Supabase หรือ Neon) | ตามที่ต้องการ, มี JSONB รองรับ template data ที่ schema ไม่ตายตัว |
| File Storage | **Supabase Storage / Cloudflare R2** | เก็บรูป/เพลงที่ผู้ใช้อัปโหลดในแต่ละ event |
| QR Generation | `qrcode` (npm) | gen ฝั่ง server ได้เลย ไม่พึ่ง service ภายนอก |
| Rate Limiting | **Upstash Redis** | ป้องกัน brute-force เดา PIN |
| Deploy | **Vercel** | รองรับ Next.js เต็มรูปแบบ, edge functions, ฟรีเริ่มต้น |
| Analytics (option) | PostHog / Vercel Analytics | เก็บสถิติการเปิดดู event |

---

## 5. Database Schema (คิดเผื่อระบบใหญ่)

แนวคิดสำคัญ: **แยก "Event" ออกจาก "Template"** และให้ template ทำงานผ่าน config (JSONB) ไม่ hardcode field ตายตัว เพื่อให้เพิ่ม template ใหม่ในอนาคตโดยไม่ต้อง migrate DB ทุกครั้ง

```sql
-- ผู้สร้าง event (ไม่บังคับสมัครสมาชิก แต่เก็บ device/browser token ไว้ผูกความเป็นเจ้าของ)
CREATE TABLE creators (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_token  TEXT UNIQUE NOT NULL,      -- เก็บใน cookie ฝั่ง browser
    email         TEXT,                       -- optional เผื่ออนาคตทำ login จริง
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- ประเภท Template ที่ระบบรองรับ
CREATE TABLE templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          TEXT UNIQUE NOT NULL,       -- 'balloon-pop', 'photo-slideshow'
    name          TEXT NOT NULL,
    description   TEXT,
    thumbnail_url TEXT,
    steps_schema  JSONB NOT NULL,             -- นิยามว่ามีกี่ step, แต่ละ step รับ field อะไร
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- อีเวนต์หลัก
CREATE TABLE events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- ใช้เป็น event id ใน URL/QR
    creator_id    UUID REFERENCES creators(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    event_date    DATE,
    template_id   UUID REFERENCES templates(id),
    template_data JSONB NOT NULL DEFAULT '{}', -- เนื้อหาที่ user กรอกตาม steps_schema
    pin_hash      TEXT NOT NULL,               -- bcrypt hash ของ pin 6 หลัก
    status        TEXT DEFAULT 'active',       -- active / archived / expired
    view_count    INTEGER DEFAULT 0,
    expires_at    TIMESTAMPTZ,                 -- เผื่ออนาคตทำ event หมดอายุอัตโนมัติ
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- log การเข้าดู (กัน brute-force + ทำ analytics)
CREATE TABLE event_access_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
    ip_address    TEXT,
    success       BOOLEAN,
    attempted_at  TIMESTAMPTZ DEFAULT now()
);

-- ไฟล์ที่ผู้ใช้อัปโหลด (แยกตารางเผื่อ event มีหลายไฟล์)
CREATE TABLE event_assets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
    asset_type    TEXT,        -- 'image' / 'audio' / 'video'
    url           TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
);
```

> **อัปเดต (implemented):** schema จริงขยายจากด้านบนแล้ว —
> - `users` + `accounts` (Auth.js): role `USER`/`ADMIN`, status `ACTIVE`/`SUSPENDED`; `events.owner_user_id` เป็น ownership หลัก ส่วน `creators.device_token` เหลือไว้เพื่อ claim การ์ด legacy ครั้งเดียวหลัง login
> - `template_versions`: published snapshot immutable (Draft/Published/Deprecated/Archived) + `events.template_version_id` pin — publish version ใหม่ไม่กระทบ event เดิม
> - `template_assets`, `template_telemetry_events` (guest funnel หลัง unlock, เก็บ device class ไม่เก็บ raw UA/IP)
> - **Card Marketplace:** `card_listings` + immutable `card_revisions` (+ assets copies) + `card_hearts` / `card_uses` (unique ต่อ user) — แยกจาก TemplateVersion; ไม่คัดลอก Event PIN
> ดู `prisma/schema.prisma` และ `docs/adr.md` ADR-4/ADR-5/ADR-7

**ทำไมออกแบบแบบนี้ (เผื่อระบบใหญ่):**
- `templates.steps_schema` เป็น JSONB → เพิ่ม template ใหม่ = insert row ใหม่ ไม่ต้อง migrate table
- `events.template_data` เป็น JSONB → แต่ละ template เก็บข้อมูลรูปแบบต่างกันได้โดยไม่ต้องมี column เผื่อทุกแบบ
- แยก `event_assets` ออกจาก event → ถ้าวันหน้ารองรับหลายรูป/หลายเพลงต่อ event ไม่ต้องแก้ schema
- แยก `event_access_logs` → ใช้ทำทั้ง security (rate limit) และ analytics ในตารางเดียว
- `creators` ใช้ device_token แทน login บังคับ → ลด friction แต่เผื่อ column `email` ไว้ถ้าจะทำ real auth ทีหลัง

---

## 6. Template System (หัวใจของระบบ ถ้าจะขยายใหญ่)

แต่ละ Template ควรถูกมองเป็น **"steps ของ config"** ไม่ใช่โค้ดผูกตายตัว

ตัวอย่าง `steps_schema` ของ template หนึ่ง:
```json
{
  "steps": [
    { "key": "opening", "type": "gift-box", "fields": ["title_text"] },
    { "key": "photos", "type": "gallery", "fields": ["image_urls", "caption"] },
    { "key": "message", "type": "text-reveal", "fields": ["message_text", "sender_name"] },
    { "key": "cake", "type": "candle-blow", "fields": ["cake_style", "background_music_url"] }
  ]
}
```

ฝั่ง Frontend: มี component 1 ตัวต่อ 1 `type` (เช่น `GiftBoxStep`, `GalleryStep`, `TextRevealStep`, `CandleBlowStep`) แล้วมี **StepRenderer** กลางที่ loop ตาม `steps_schema` แล้ว dynamic-render component ตาม `type`

ข้อดี: เพิ่ม Template ใหม่ในอนาคต = ผสม step type ที่มีอยู่แล้วในรูปแบบใหม่ ไม่ต้องเขียนโค้ดใหม่ทั้งหมด (คล้าย Lego)

---

## 7. API Endpoints (โครงคร่าวๆ)

```
POST   /api/events                     สร้าง event ใหม่ (return id + pin)
GET    /api/events                     list event ของ creator (ใช้ device_token)
GET    /api/events/:id                 ดูรายละเอียด event (ฝั่ง admin)
PATCH  /api/events/:id                 แก้ไข event
DELETE /api/events/:id                 ลบ event
POST   /api/events/:id/regenerate-pin  ตั้ง pin ใหม่

GET    /api/templates                  list template ที่เลือกได้

POST   /api/e/:id/verify-pin           guest กรอก pin เพื่อปลดล็อก (rate-limited)
GET    /api/e/:id/view                 ดึงข้อมูล template_data หลังปลดล็อกแล้ว (ผ่าน session/token ชั่วคราว)
```

**หมายเหตุ security:** หลังกรอก PIN ถูก ควร issue short-lived token (เช่น JWT อายุ 15-30 นาที เก็บใน cookie) แทนที่จะยอมให้ยิง `GET /api/e/:id/view` ตรงๆ โดยไม่ verify ทุกครั้ง

---

## 8. Security Checklist

- [ ] Hash PIN ด้วย bcrypt/argon2 ห้ามเก็บ plain text
- [ ] Rate limit การกรอก PIN ต่อ IP/event (เช่น 5 ครั้ง / 10 นาที)
- [ ] Event ID ใช้ UUID (เดายาก) ไม่ใช้ auto-increment id
- [ ] Validate ไฟล์ที่ผู้ใช้อัปโหลด (type, size) ก่อนขึ้น storage
- [ ] Sanitize ข้อความที่ผู้ใช้กรอก (กัน XSS ในหน้า guest)
- [ ] Creator แก้ไข/ลบ event ได้เฉพาะของตัวเอง (เช็ค device_token ทุก request)
- [ ] Set `expires_at` option ให้ event หมดอายุอัตโนมัติได้ (ลดข้อมูลค้าง)

---

## 9. แผนการพัฒนา (Roadmap แบบ Phase)

**Phase 1 — MVP**
- สร้าง/แก้ไข/ลบ event, gen PIN + QR
- Template พื้นฐาน 1-2 แบบ
- หน้า guest กรอก PIN + ดูโมเดล

**Phase 2 — Usability**
- เพิ่ม Template หลายแบบ พร้อม preview ก่อนเลือก
- Analytics เบื้องต้น (ดูกี่ครั้ง, ใครเปิดเมื่อไหร่)
- Responsive/PWA ให้เปิดจากมือถือลื่นขึ้น

**Phase 3 — Scale**
- ระบบ login จริง (ผูก email) แทน device_token อย่างเดียว
- Marketplace template (ให้ผู้ใช้อื่น design template ส่งเข้าระบบ)
- รองรับ event ประเภทอื่นนอกจาก birthday (แต่งงาน, ขอบคุณ ฯลฯ)
- Guest ตอบกลับได้ (ส่งข้อความ/หัวใจ กลับไปหาผู้สร้าง)

---

## 10. สรุปสิ่งที่ต้องเตรียมก่อนเริ่มโค้ดจริง

1. Setup Next.js + TypeScript + Tailwind project
2. Setup PostgreSQL (Supabase/Neon) + Prisma schema ตามข้อ 5
3. ออกแบบ 1 Template แรกให้เสร็จ (กำหนด steps_schema ให้ชัด) ก่อนเขียน UI
4. เขียน API สร้าง/verify event ก่อน แล้วค่อยทำ UI ครอบ
5. ทำ QR + PIN flow ให้ end-to-end ทำงานได้ก่อน ค่อยเติมความสวยงาม (animation) ทีหลัง
