# Wish-Flow — Goal Ledger

Focus: G9 Wedding Guestbook  
Status: **completed**  
Last Updated: 2026-07-21  
Sources: `docs/system-design.md`, `flow.md`, `AGENTS.md`, `docs/adr.md` ADR-8

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

### G5: Auth + RBAC — DONE 2026-07-21
- [x] Auth.js (email/password + Google optional), JWT session
- [x] Roles: USER / ADMIN / Guest(PIN)
- [x] Event ownership = `ownerUserId`; claim legacy device cards once on login
- [x] Admin: manage users (suspend/role) + read-only all cards; cannot mutate other users' cards
- [x] Tests: 63 passed (incl. claim-once, ownership, admin demotion guards)
- [x] `npm run build` passed
- [x] Docs sync: `AGENTS.md` (session identity + immutable version rules), `flow.md` (ownership, auth/admin API map), `docs/system-design.md` (schema update note), `README.md`
- **Evidence (2026-07-21 verification round กับ Neon):**
  - `prisma migrate status` กับ Neon (`ap-southeast-1`) — 4 migrations applied, schema up to date
  - `npm run db:seed` กับ Neon — 13 templates + admin bootstrap (idempotent, ไม่ทับ published schema)
  - `npm test` — **70/70 ผ่าน**, `npm run build` — ผ่าน
  - Smoke flow (dev server + curl): register → login (credentials 302 + session มี role/status) → claim-device 200 → create card + PIN → guest verify-pin ถูก 200 / ผิด 401 (`remaining` ลด) → view 200 → admin login → `/api/admin/events` 200 ไม่มี `pinHash` → admin PATCH/DELETE การ์ดของ user อื่น = **404** → `/api/admin/users`, `/api/admin/templates` 200 → USER เรียก `/api/admin/users` = **403**

### G6: Template Studio (Milestones A → B → C) — DONE 2026-07-21
- [x] **A — Versioning:** `TemplateVersion` lifecycle Draft/Published/Deprecated/Archived; published immutable; `Event.templateVersionId` pin + backfill; seed ไม่ทับ published schema; ADR-5
- [x] **A — Admin APIs:** `/api/admin/templates` list/create/get/update/duplicate/validate/publish/versions/rollback/assets (+ analytics)
- [x] **A — Library UI:** `/admin/templates` search/filter/sort/pagination + metadata + publish confirmation/release notes (Admin-only)
- [x] **B — Builder:** responsive 3-panel (Step Library / Flow Canvas / Properties), `@dnd-kit` reorder, undo/redo, mobile bottom-sheet mode
- [x] **B — Data Model Designer:** field types ตาม IA + Basic/Pro settings + Global→Step→Element override แบบ allow-listed
- [x] **B — Preview:** `StepRenderer` เดียวกับ guest + validation panel + jump-to-step
- [x] **C — Expert rules:** declarative runtime rules (ไม่มี arbitrary JS/`eval`)
- [x] **C — QA publish gate:** schema, sample data, a11y baseline, asset/byte budget, reduced-motion, minigame registry capability
- [x] **C — Analytics:** `template_telemetry_events` จริงหลัง unlock token; admin analytics จาก unlock logs + telemetry (ไม่สร้างข้อมูลปลอม)
- [x] **C — Marketplace metadata:** visibility / premium / featured / price label — **ไม่มี payment provider**
- **Evidence (2026-07-21):**
  - Migration: `20260721120000_template_studio_versions` (local Docker `:5435`)
  - Seed: 13 templates + published v1 immutable policy
  - `npm test` — **70/70 ผ่าน**
  - `npm run build` — ผ่าน (routes รวม `/admin/templates`, studio APIs, telemetry)
  - Compatibility: publish v2 ไม่ขยับ `Event.templateVersionId` ของ event เดิม (integration test)
  - Template Studio UI ใช้ภาษาไทยทั้งหน้าคลังและตัวสร้าง: สถานะ, เมนู, คุณสมบัติ, โครงสร้างข้อมูล, การตรวจสอบ, เผยแพร่ และข้อมูลวิเคราะห์; `npm run build` ผ่าน

### G7: Support & Account Security (A→E) — DONE 2026-07-21
- Spec: `docs/support-ops-milestones.md` + `docs/milestones/A|B|C|D|E-*.md`
- [x] **A — Account Security:** User schema (securityPin*, mustChange*, authVersion, username, phone), Security PIN ของบัญชี (bcrypt, 6 หลัก, lockout 5 ครั้ง/15 นาที), step-up JWT cookie `wf_admin_step_up` (5 นาที), admin reset password/PIN (temp จาก `crypto.randomBytes` โชว์ครั้งเดียว + `Cache-Control: no-store`, self-reset ถูกบล็อก), `/profile` (แก้ชื่อ/username/phone + เปลี่ยน/ตั้งรหัสผ่าน + PIN สำหรับ admin), `AdminSecurityPinModal` บังคับ admin ตั้ง PIN, `requireUser` re-check status+authVersion จาก DB (bump = force re-login)
- [x] **B — Support Cases:** `/support/contact` (public, ไม่ต้อง login), token 32 bytes → sha256 ใน DB โชว์ครั้งเดียว, ติดตามเคส `/support/cases/:id?token=`, rate limit ipHash+deviceId (5/ชม.), CAPTCHA stub (`src/lib/captcha.ts` — Turnstile จริงเมื่อตั้ง `TURNSTILE_SECRET`), `/admin/support` list/filter/claim (race-safe `updateMany`)/status/priority/internal note, สถานะ NEW→CLAIMED→IN_PROGRESS→WAITING_USER→RESOLVED→CLOSED (+SPAM) + history, ปุ่มติดต่อเจ้าหน้าที่หน้า `/`
- [x] **C — Chat:** `SupportConversation` unique userId (1 user = 1 ห้อง), `/support/chat` (user) + `/admin/inbox` (admin), polling 4s (**ไม่มี** Ably/Pusher keys — บันทึกใน Blocked), user เห็น admin เป็น 「เจ้าหน้าที่」 เท่านั้น / admin เห็น `Admin (ชื่อ)`, INTERNAL ซ่อนจาก user, unread counters, authorize server-side ทุก request
- [x] **D — Hardening:** `NotificationAdapter` + ConsoleNotificationAdapter + `AppNotification` in-app (`/api/me/notifications`), authVersion bump ครบจุด (change/set password, admin reset), retention scripts `scripts/cleanup-logs.ts` + `scripts/cleanup-support-retention.ts` (รองรับ `--dry-run`), ล้าง ipHash/deviceId/uaDigest เคสปิด >30 วัน, ไม่เก็บ MAC/plain token
- [x] **E — Logs:** `AuditLog` + `SystemLog` + action catalog (`src/lib/audit-actions.ts`), `writeAudit`/`writeSystemLog` (insert fail ไม่ throw — ลง system log แทน), `sanitizeMetadata` ตัด password/pin/token/secret/authorization/cookie (nested), `hashIp`/`digestUa` pepper จาก AUTH_SECRET, `/admin/logs` (Audit/System tabs + filter + pagination + export CSV/JSON ≤5000 แถว + audit การ export), retention: audit 365 วัน / system ERROR 180 / INFO 30
- **Evidence (2026-07-21):**
  - Migrations: `20260721150000_g7_support_ops` + `20260721153000_g7_fix_sender_type_column` applied กับ Neon
  - `npm test` — **100/100 ผ่าน** (13 ไฟล์; ใหม่: account-security, support-case, support-chat integration + audit-log sanitize unit)
  - `npm run build` — ผ่าน (routes ใหม่: `/profile`, `/support/*`, `/admin/support*`, `/admin/inbox*`, `/admin/logs`, APIs `me/*`, `admin/step-up`, `admin/users/[id]/reset-*`, `support/*`, `admin/support/*`, `admin/inbox/*`, `admin/logs/*`)
  - Cleanup scripts dry-run ผ่าน (`cleanup-logs`, `cleanup-support-retention`)
  - Security: PIN/password/token เก็บ hash เท่านั้น, audit metadata ผ่าน sanitize (มี test ยืนยันไม่รั่ว), step-up 428 → modal ยืนยัน PIN, self-reset DENIED + audit, ชื่อ admin ไม่หลุดใน payload ฝั่ง user (test ยืนยัน), `Event.pinHash` ไม่ถูกแตะ

### G8: Role Dashboard + Card Marketplace — DONE 2026-07-21
- [x] Admin Users: แท็บแยก `ADMIN`/`USER` + pagination เริ่มต้น 10 + dropdown 10/20/50; ปิดปุ่มลด role/ระงับตัวเองใน UI; server guard demote/suspend ตัวเอง + last-admin + audit DENIED
- [x] หน้าแรกตาม role: Guest เห็น marketing `/`; login แล้ว USER → `/events`, ADMIN → `/admin` hub; brand nav ตาม role; `/marketplace` ต้อง login
- [x] Card Marketplace: `card_listings` / `card_revisions` / assets / hearts / uses; publish snapshot (opt-in รูป); heart + นำไปใช้ (PIN ใหม่, unique count); duplicate clone assets + lineage
- [x] Expiry hard-gate: verify-pin / view / telemetry + overlay บน list / guest / edit preview; ThaiDatePicker ปีกว้างขึ้นสำหรับวันสำคัญ
- Spec / ADR: `docs/adr.md` ADR-7
- **Evidence (2026-07-21):**
  - Migration: `20260721170000_card_marketplace` applied (local Docker `:5435`)
  - `npm test` — **104/104 ผ่าน**
  - `npm run build` — ผ่าน (routes: `/admin`, `/marketplace`, share/marketplace APIs)
  - Guards: cannot_demote_self / cannot_suspend_self / last_admin + UI disable self actions
  - Marketplace: snapshot immutable ตอน publish; ไม่คัดลอก pinHash; useCount นับ unique user

### G9: Wedding Guestbook — DONE 2026-07-21
- [x] Schema: `guestAccessMode` PIN|PUBLIC + `guestbookEnabled` + `GuestbookEntry` statuses + indexes; migration `20260721220000_g9_guestbook`
- [x] Storage: R2 adapter (S3-compatible) เมื่อตั้ง `R2_*`; guestbook prefix private; ACL proxy; orphan cleanup รวม guestbook; ลบรูปตอน reject/delete/event delete
- [x] Public flow: meta/submit/wall/photos + `/e/[id]` PUBLIC landing + `/e/[id]/guestbook` (ชื่อ/รูป optional, กล้องหน้า/หลัง/คลัง, wall polling)
- [x] Owner: edit toggles + `/events/[id]/wishes` moderation (filter, pagination 10/20/50, bulk ≤50) + notification + audit (ไม่เก็บเนื้อหาคำอวยพรใน metadata)
- [x] Template: step `guestbook-cta` + seed `wedding-guestbook` (ADR-5 immutable published)
- [x] Compatibility: PIN cards เดิมไม่พัง; duplicate ไม่คัดลอก entries
- Spec / ADR: `docs/adr.md` ADR-8
- **Evidence (2026-07-21):**
  - Migration `20260721220000_g9_guestbook` applied local Docker `:5435`
  - Seed: **14 templates** รวม `wedding-guestbook` (published schemas immutable)
  - `npm test` — **115/115 ผ่าน** (guestbook integration: public submit, ACL, rate limit, bulk, duplicate ไม่คัดลอก entries, audit sanitize)
  - `npm run build` — ผ่าน (routes: `/e/[id]/guestbook`, `/events/[id]/wishes`, guestbook APIs, R2 storage)
  - Storage: local default; R2 เมื่อตั้ง `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`
  - Deploy note: รัน `prisma migrate deploy` บน Neon + ตั้ง R2 env บน Vercel ก่อนเปิด photo upload จริง

## Deferred

- Google OAuth credentials บน production (ตั้ง `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`)
- image optimization / Playwright E2E / PWA
- Phase 3: event types อื่น, guest reply
- Marketplace **payment/checkout** (ต้องการ payment provider)
- Automated browser a11y/performance audit (Playwright) สำหรับ publish gate ชั้นสูง
- Designer / Reviewer / Analyst roles + In Review workflow (Milestone A ใช้ Admin-only ตามแผน)

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
| 2026-07-21 | Template Studio: event pin published version; Admin-only publish; rollback = publish clone — ADR-5 |

---

## Blocked

- Marketplace payment/checkout — ต้องการเลือก payment provider ก่อน
- Full automated a11y/perf browser gate — ติด Playwright E2E ที่ยังไม่ติดตั้ง
- **Realtime chat provider (Ably/Pusher)** — ยังไม่มี API keys; ตอนนี้ persistence ครบ + polling 4s fallback ใช้งานจริง (`/support/chat`, `/admin/inbox`) — เมื่อได้ keys ให้ publish หลัง commit DB + channel auth ต่อห้อง
- **Turnstile CAPTCHA** — ยังไม่มี `TURNSTILE_SECRET`; `verifyCaptchaToken` เป็น stub ผ่านเสมอ (โค้ดตรวจจริงพร้อมแล้ว ตั้ง env ก็ทำงาน) — มี rate limit ip/device คุมแทนชั่วคราว
- **Email notification provider** — ยังไม่เลือก provider; ใช้ `ConsoleNotificationAdapter` + in-app `AppNotification` ไปก่อน (ห้าม claim ว่าส่งอีเมลจริง)

## Completed

- [x] 2026-07-21 — Project init (docs, Docker, Prisma, pin tests)
- [x] 2026-07-21 — **G1 MVP end-to-end** (API + UI + tests + build)
- [x] 2026-07-21 — **Phase 2 Enhancement** (ปฏิทิน พ.ศ. + อัปโหลดรูป + Template Explorer + 21 step types + 13 templates + edit page ใหม่ + draft/duplicate/expiry — 62 tests ผ่าน)
- [x] 2026-07-21 — **Template Studio IA Spec** (`docs/template-studio-ia.md`: โครงหน้าจอ, ตั้งค่าย่อย Basic/Pro/Expert, role permission, versioning/publish gate, analytics, rollout milestones)
- [x] 2026-07-21 — **Expansion Roadmap** (`docs/expansion-roadmap.md`: ขยายจาก HBD สู่ Personal Micro-site Generator, จัดลำดับ Track A-E, แนะนำ Time Capsule เป็น M1, ระบุผลกระทบ UX/API/Domain + milestones + metrics)
- [x] 2026-07-21 — **Template Studio A→B→C** (immutable versions + event pin, admin library/builder, QA gate, real telemetry analytics, marketplace metadata — 70 tests + build ผ่าน)
- [x] 2026-07-21 — **G7 Support & Account Security specs** (`docs/support-ops-milestones.md`, milestones A–E รวม System/Audit Log, `docs/AI_SUPPORT_OPS_PROMPT.md`)
- [x] 2026-07-21 — **G7 Support & Account Security A→E implemented** (Security PIN + step-up + admin reset, `/profile`, public support cases + admin console, chat 1:1 polling, NotificationAdapter + retention scripts, Audit/System Log + `/admin/logs` + export — 100 tests + build ผ่าน)
- [x] 2026-07-21 — **G8 Role Dashboard + Card Marketplace** (admin users by role + pagination, role home `/admin`, card share snapshots/hearts/use, expiry overlay — 104 tests + build ผ่าน)
