# Wish-Flow — Goal Ledger

Focus: G1 + Phase 2 Enhancement  
Status: **completed**  
Last Updated: 2026-07-21  
Sources: `docs/system-design.md`, `flow.md`, `AGENTS.md`

---

## North Star

สร้าง **Wish-Flow** — เว็บสร้างอีเวนต์อวยพร (เริ่มจาก HBD) ที่:
สร้างง่าย (ไม่ต้องสมัคร) → แชร์ง่าย (QR/ลิงก์) → ปลอดภัยพอประมาณ (PIN) → ดูแล้วประทับใจ (template + animation)

รองรับ **ทุกอุปกรณ์** (mobile-first, tablet, desktop) เพราะ guest ส่วนใหญ่เปิดจากมือถือผ่าน QR

มองระยะยาวเป็น **Micro-site Builder as a Service**

---

## Active Goals

### G1: Ship Phase 1 MVP (end-to-end) — DONE
- **Outcome:** Creator สร้าง event → ได้ Event ID + PIN + QR → Guest กรอก PIN ถูกแล้วเห็น template HBD ตาม step
- **Scope:** F1–F10, Guest G1–G3
- **Done when:**
  1. [x] `docker compose up -d` แล้ว Postgres พร้อม
  2. [x] `npm run db:migrate` / seed ผ่าน
  3. [x] `npm run dev` รัน local ได้
  4. [x] `npm test` ผ่าน (unit + API integration กับ Postgres) — **18/18**
  5. [x] Creator CRUD + QR + Guest PIN lock/unlock ใช้ได้จริง
  6. [x] UI mobile-first (viewport + responsive layouts)
  7. [x] PIN ไม่เก็บ plain text (bcrypt)
- **Evidence (2026-07-21 G1 complete):**
  - Docker: `wishflow-postgres` healthy `:5435`
  - migrate deploy + seed (`hbd-classic`, `hbd-short`)
  - `npm test` — 18 passed (pin, sanitize, unlock JWT, event-service integration incl. rate limit)
  - `npm run build` — success
  - APIs: events CRUD, regenerate-pin, qr, templates, verify-pin, view
  - UI: `/`, `/events`, `/events/[id]/edit`, `/e/[id]`, `/e/[id]/view` + StepRenderer
- **Evidence (2026-07-21 รอบปรับ UX ภาษาไทย):**
  - UI ไทยทั้งระบบ + error API เป็นไทย, ธีมการ์ตูนพาสเทล + ฟอนต์ Mali (next/font)
  - PIN ตั้งเองได้ตอนสร้าง + เปลี่ยน PIN เองในหน้าแก้ไข
  - หน้า guest เป็น numpad กดบนจอ (จุด ●●● + animation pop/wobble)
  - ปุ่มบันทึกเดียว → save แล้วกลับ /events
  - `npm test` — **20/20 ผ่าน** (เพิ่มเทส custom PIN 2 ตัว)
  - `npm run build` — ผ่าน (โหลดฟอนต์ Mali สำเร็จ)
  - Runtime จริง: `/`, `/events` = 200, create event PIN "123456" → verify ถูก = ok, ผิด = "PIN ไม่ถูกต้อง" (401), templates ชื่อไทย

### G2: Template system (Lego) — DONE (Phase 2)
- [x] `steps_schema` + `StepRenderer` registry
- [x] **21 step types**: ข้อความ 7 (gift-box, text-reveal, typewriter-message, envelope-open, countdown, candle-blow, final-celebration) + รูปภาพ 7 (photo-reveal, photo-polaroid, photo-slideshow, photo-collage, memory-timeline, scratch-card, puzzle-photo) + มินิเกม 7 (tap-the-balloon, catch-the-heart, memory-match, birthday-quiz, spin-the-wheel, find-the-gift, confetti-pop)
- [x] **13 seed templates** ครอบคลุม 7 หมวด — สร้างจาก config ล้วน ไม่มี component ต่อ template
- [x] มินิเกม: touch+mouse, ปุ่มข้าม, ไม่ใช่ security gate, prefers-reduced-motion, fallback emoji

### G4 (Phase 2 Enhancement) — DONE 2026-07-21
- [x] **ปฏิทิน พ.ศ.** `ThaiDatePicker` — แสดง DD-MM-YYYY พ.ศ., เก็บ ISO ใน DB, dropdown เดือน/ปี, ไม่ใช้ native date input (`src/lib/thai-date.ts` + unit tests)
- [x] **อัปโหลดรูป** — storage adapter (local → R2/Supabase ได้), ≤5MB, JPG/PNG/WebP, ตรวจ magic bytes+MIME+ext, ชื่อไฟล์ UUID, กัน path traversal, preview/progress/ลบ/เรียงลำดับ, ลบแล้วหายทั้ง storage+DB
- [x] **Template Explorer** — bottom sheet (มือถือ)/modal (desktop), ค้นหา debounce, 7 หมวด, filter เกม/พรีเมียม, sort แนะนำ/ใหม่/ยอดนิยม, pagination (limit ≤24), preview ด้วยข้อมูลตัวอย่าง, favorite/recent ใน localStorage, focus trap + Escape
- [x] **Template metadata** — migration `template_metadata_assets`: category, tags, mood, preview_url, required_asset_count, is_premium, sort_order, usage_count, published_at + asset fields (mime_type, size_bytes, sort_order)
- [x] **หน้าแก้ไข 4 ส่วน** — ข้อมูลพื้นฐาน/รูปภาพ/เทมเพลต/เนื้อหา (progressive disclosure), autosave 2s + สถานะ "บันทึกแล้ว", ปุ่มเดียว "บันทึกและกลับ", เตือน beforeunload, preview มือถือ
- [x] **Foundation** — draft/published toggle, วันหมดอายุ (ปฏิทิน พ.ศ.), duplicate event, สถิติ unlock สำเร็จ/ไม่สำเร็จ, cleanup script orphan assets, backup/restore docs (`docs/adr.md`)

### G3: Security baseline — DONE for MVP
- [x] PIN hash (bcrypt)
- [x] Rate limit via `event_access_logs` (5 / 10 min per IP+event)
- [x] UUID event id
- [x] device_token ownership checks
- [x] short-lived unlock JWT cookie
- [x] sanitize guest-facing template_data

---

## Evidence (2026-07-21 Phase 2 Enhancement)

- Migration: `20260721042611_template_metadata_assets` applied
- Seed: **13 templates** (`Seeded 13 templates`)
- `npm test` — **62/62 ผ่าน** (6 ไฟล์: pin, sanitize, thai-date, upload-validation, event-service integration, enhance integration)
- `npm run build` — ผ่าน (compile + lint + typecheck)
- Runtime จริง (dev server :3000):
  - สร้าง event PIN 123456 → 201
  - `GET /api/templates?q=โพลารอยด์` เจอ polaroid-album, `category=minigame&limit=3` ถูก filter
  - `GET /api/templates/polaroid-album/preview` คืน sample data
  - อัปโหลด JPEG → 201, เสิร์ฟกลับผ่าน `/api/uploads/...` = 200 image/jpeg
  - PATCH templateId + templateData + eventDate → 200
  - duplicate → 201 พร้อม PIN ใหม่ (status draft)
  - guest verify-pin ถูก → view คืน template + assets, PIN ผิด → 401 ข้อความไทย
  - หน้า `/`, `/events`, `/e/[id]` = 200

## Deferred

- **Phase 2 ที่เหลือ:** image optimization ขั้นสูง (sharp/resize), E2E ด้วย Playwright, analytics UI dashboard, PWA, Framer/Lottie polish
- **G5 Phase 3:** email login, event types อื่น, guest reply, marketplace

---

## Decisions

| วันที่ | การตัดสินใจ |
|--------|-------------|
| 2026-07-21 | ชื่อโปรเจกต์: **wish-flow** |
| 2026-07-21 | Local DB: Postgres Docker Compose พอร์ต **5435** |
| 2026-07-21 | Rate limit MVP ใช้ DB logs (ไม่บังคับ Redis) |
| 2026-07-21 | Business logic ใน `event-service` — API เป็น thin wrapper + เทสยิง Postgres |
| 2026-07-21 | ปฏิทิน: เขียน `ThaiDatePicker` เอง (Tailwind) ไม่พึ่ง MUI/Ant — ดู `docs/adr.md` ADR-1 |
| 2026-07-21 | วันที่: DB/API เก็บ ISO เสมอ แปลง พ.ศ. เฉพาะชั้น UI — ADR-2 |
| 2026-07-21 | รูปภาพ: `StorageAdapter` interface, MVP เก็บ local `uploads/`, เสิร์ฟผ่าน route — ADR-3 |
| 2026-07-21 | Template = config ใน seed เท่านั้น ประกอบจาก step registry 21 types |

---

## Blocked

_(ว่าง)_

## Completed

- [x] 2026-07-21 — Project init (docs, Docker, Prisma, pin tests)
- [x] 2026-07-21 — **G1 MVP end-to-end** (API + UI + tests + build)
- [x] 2026-07-21 — **Phase 2 Enhancement** (ปฏิทิน พ.ศ. + อัปโหลดรูป + Template Explorer + 21 step types + 13 templates + edit page ใหม่ + draft/duplicate/expiry — 62 tests ผ่าน)
- [x] 2026-07-21 — **Template Studio IA Spec** (`docs/template-studio-ia.md`: โครงหน้าจอ, ตั้งค่าย่อย Basic/Pro/Expert, role permission, versioning/publish gate, analytics, rollout milestones)
