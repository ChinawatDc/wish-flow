# Milestone E — System Log + Audit Log

Status: **completed** (2026-07-21)  
Depends on: **Milestone A** เป็นอย่างน้อย (มีจุด security สำคัญ); แนะนำทำหลัง **D** เพื่อครอบคลุม event จาก B/C ด้วย  
ลำดับในแผนรวม: A → B → C → D → **E**

---

## Goal

สร้างระบบบันทึกเหตุการณ์แบบมีโครงสร้าง แยกชัดระหว่าง:

| ประเภท | ใช้ทำอะไร | ใครดูได้ |
|--------|-----------|----------|
| **Audit Log** | การกระทำที่มีผลต่อความปลอดภัย / สิทธิ์ / ข้อมูลสำคัญ (ใครทำอะไร กับใคร เมื่อไหร่) | Admin เท่านั้น |
| **System Log** | เหตุการณ์ระบบ / API error / job / integration (สำหรับ debug และ ops) | Admin เท่านั้น (หรือระดับที่สูงกว่าถ้ามี) |

ห้ามเก็บ secret แบบ plain text ใน log ทุกชนิด (password, Security PIN, Event PIN, public case token, step-up token, Authorization header)

---

## แยกจากที่มีอยู่แล้ว

| ของเดิม | ไม่ใช่ Audit/System Log |
|---------|-------------------------|
| `event_access_logs` | rate-limit + สถิติ unlock การ์ด |
| `template_telemetry_events` | funnel guest หลัง unlock |
| console / Vercel logs | ไม่มี query UI ในแอป และไม่มี actor context ครบ |

Milestone E สร้างตาราง + API + UI ในแอป และให้ service ชั้นสำคัญเรียก `audit()` / `systemLog()` กลาง

หมายเหตุ: Milestone A อาจมี `AuditLog` แบบบางสำหรับ reset/role — **E ขยายให้เป็นระบบเต็ม** (taxonomy, search UI, retention, export) และ migrate รวม/เปลี่ยนชื่อให้สอดคล้อง ไม่สร้างตารางซ้ำมั่ว

---

## Scope

### 1. Schema (Prisma migrate)

#### `AuditLog` (หรือขยายของที่มีจาก A)

| Field | หมายเหตุ |
|-------|----------|
| `id` | UUID |
| `occurredAt` | เวลาเหตุการณ์ |
| `actorUserId` | ผู้กระทำ (nullable ถ้าระบบ/anonymous) |
| `actorRole` | snapshot ตอนเกิดเหตุ |
| `actorEmail` | snapshot (optional) — ห้ามเป็นช่องแก้ได้ย้อนหลัง |
| `action` | enum/string คงที่ เช่น `USER.PASSWORD_RESET`, `ADMIN.ROLE_CHANGE` |
| `resourceType` | เช่น `user`, `event`, `support_case`, `template`, `conversation` |
| `resourceId` | UUID/string ของเป้าหมาย |
| `outcome` | `SUCCESS` / `FAILURE` / `DENIED` |
| `ipHash` | hash + pepper (ไม่เก็บ IP ดิบระยะยาวถ้าไม่จำเป็น) |
| `deviceId` | จาก cookie ถ้ามี |
| `requestId` | correlator ต่อ request |
| `summaryTh` | ข้อความสั้นภาษาไทยสำหรับ UI |
| `metadata` | JSONB — **allow-listed keys เท่านั้น**, ไม่มี secret |
| `prevHash` / `entryHash` | optional chain สำหรับตรวจแก้ log (ถ้าทำได้โดยไม่ซับซ้อนเกิน — อย่างน้อยเตรียมคอลัมน์หรือ ADR ว่าเลื่อน) |

Index: `(occurredAt desc)`, `(action, occurredAt)`, `(resourceType, resourceId)`, `(actorUserId, occurredAt)`

#### `SystemLog`

| Field | หมายเหตุ |
|-------|----------|
| `id` | UUID |
| `occurredAt` | |
| `level` | `DEBUG` / `INFO` / `WARN` / `ERROR` / `FATAL` |
| `source` | เช่น `api`, `job`, `auth`, `storage`, `realtime` |
| `code` | รหัสคงที่ เช่น `STORAGE_SAVE_FAILED` |
| `message` | ข้อความสั้น ไม่มี PII/secret |
| `requestId` | |
| `route` | path/template ของ API |
| `httpStatus` | optional |
| `durationMs` | optional |
| `metadata` | JSONB sanitized |
| `errorName` | optional |
| `stackDigest` | optional — hash หรือตัดสั้น ไม่ dump secret |

Index: `(occurredAt desc)`, `(level, occurredAt)`, `(source, code, occurredAt)`

### 2. Taxonomy (action catalog)

กำหนดรายการ `action` ในโค้ดกลาง (const/enum) อย่างน้อย:

**Auth / Account**
- `AUTH.LOGIN_SUCCESS` / `AUTH.LOGIN_FAILURE` / `AUTH.LOGOUT`
- `AUTH.REGISTER`
- `USER.PASSWORD_CHANGE` / `USER.PASSWORD_SET`
- `USER.SECURITY_PIN_SET` / `USER.SECURITY_PIN_CHANGE` / `USER.SECURITY_PIN_LOCKOUT`
- `ADMIN.STEP_UP_SUCCESS` / `ADMIN.STEP_UP_FAILURE`
- `ADMIN.PASSWORD_RESET` / `ADMIN.SECURITY_PIN_RESET`
- `ADMIN.USER_ROLE_CHANGE` / `ADMIN.USER_STATUS_CHANGE`

**Support / Chat (เมื่อมีจาก B/C)**
- `SUPPORT.CASE_CREATE` / `SUPPORT.CASE_CLAIM` / `SUPPORT.CASE_CLOSE` / `SUPPORT.CASE_ASSIGN`
- `SUPPORT.CASE_REPLY_PUBLIC` / `SUPPORT.CASE_NOTE_INTERNAL`
- `CHAT.CONVERSATION_CREATE` / `CHAT.MESSAGE_SEND` (ไม่เก็บเนื้อหาเต็มใน audit ถ้ายาว — เก็บ messageId)

**Template Studio / Events (ระดับ admin/sensitive)**
- `TEMPLATE.PUBLISH` / `TEMPLATE.ROLLBACK`
- `EVENT.DELETE` (ของเจ้าของเอง — audit ได้)

**System**
- ใช้ `SystemLog` สำหรับ unhandled error, job failure, storage failure, migrate/seed bootstrap (ระวังอย่า log secret จาก env)

### 3. Service กลาง

สร้าง เช่น `src/lib/audit-log.ts` และ `src/lib/system-log.ts`:

- `writeAudit({ action, actor, resource, outcome, metadata })` — fire-and-forget แบบปลอดภัย (อย่าให้ audit fail แล้วกลืน business error โดยไม่ตั้งใจ; อย่างน้อย log ไป system เมื่อ audit insert พัง)
- `writeSystemLog({ level, source, code, message, metadata })`
- helper `sanitizeMetadata()` ตัด key อันตราย: `password`, `pin`, `token`, `authorization`, `cookie`, `secret`, …
- ผูก `requestId` จาก middleware/header ถ้ามี

จุดเรียก: ใส่ใน service ที่ sensitive ของ A/B/C/D — อย่ากระจาย `prisma.auditLog.create` ทั่ว routes โดยไม่มี wrapper

### 4. Admin UI

หน้า `/admin/logs` (หรือแยกแท็บ):

1. **Audit** — ค้นหา/filter: ช่วงเวลา, action, actor, resourceType, outcome; ดูรายละเอียดรายแถว
2. **System** — filter: level, source, code, ช่วงเวลา
3. ปุ่ม refresh; pagination; ภาษาไทย
4. **Export CSV/JSON** (Admin only) — ไม่รวมฟิลด์ที่ sanitize ตัดแล้ว; rate limit export

ห้ามให้ USER เข้าถึง API/UI นี้

### 5. APIs

| Method | Path |
|--------|------|
| GET | `/api/admin/logs/audit?from=&to=&action=&actorUserId=&resourceType=&outcome=&page=` |
| GET | `/api/admin/logs/audit/:id` |
| GET | `/api/admin/logs/system?from=&to=&level=&source=&code=&page=` |
| GET | `/api/admin/logs/system/:id` |
| POST | `/api/admin/logs/export` (body: type audit\|system + filters) |

ทุกเส้น `requireAdmin()` + (ถ้ามี Security PIN จาก A) พิจารณา step-up สำหรับ export

### 6. Retention

- นโยบายเริ่มต้นที่แนะนำ: Audit เก็บ 180–365 วัน; System ERROR+ 90–180 วัน; DEBUG/INFO สั้นกว่า (เช่น 14–30 วัน)
- script `scripts/cleanup-logs.ts` รองรับ `--dry-run`
- document ใน ADR / goal Evidence
- ห้ามลบ audit ที่เกี่ยวกับ security ก่อนครบนโยบายโดยไม่มีเหตุผล

### 7. Tests

- เขียน audit เมื่อ reset password / เปลี่ยน role / claim case (ถ้ามี)
- metadata ที่มี `password`/`pin` ถูกตัดก่อนลง DB
- USER เรียก `/api/admin/logs/*` ได้ 403
- export ต้องเป็น admin
- pagination ทำงาน
- cleanup dry-run ไม่ลบจริง

---

## Out of scope (ห้ามทำเกินใน E)

- ส่ง log ไป Datadog/Sentry ภายนอก (ทำ adapter stub ได้ แต่ไม่บังคับ provider)
- แก้ business flow ของ A–D นอกจากใส่จุดเรียก audit
- เก็บ full request/response body ทุก API (เสียงดังและเสี่ยง PII)

---

## Done criteria

- [ ] Schema `AuditLog` + `SystemLog` (หรือเทียบเท่า) migrate ผ่าน
- [ ] wrapper กลาง + sanitize + action catalog
- [ ] จุดเรียกครอบคลุมอย่างน้อย: login fail/success (ถ้าทำได้โดยไม่ noisy เกิน), password/PIN change/reset, role/status, support claim/close (ถ้ามี B), template publish (ถ้าแตะได้)
- [ ] `/admin/logs` UI ภาษาไทย ใช้งานได้
- [ ] Admin APIs + export พื้นฐาน
- [ ] retention script + docs
- [ ] tests ผ่าน; `npm test` + `npm run build` ผ่าน
- [ ] อัปเดต `goal.md` Evidence, `flow.md` API map, `docs/system-design.md`, ADR สั้น ๆ (เช่น ADR-6 Audit/System Log)

---

## Risks

- Log volume สูงจาก login failure / chat message → จำกัด action ที่เขียน audit; chat เก็บแค่ id ไม่เก็บข้อความเต็มใน audit
- Audit insert ล้มแล้วกลืน error ธุรกิจ → แยก try/catch + system log
- PII ใน metadata → sanitize เข้ม + review ใน test
- สับสนกับ `event_access_logs` → เอกสารและ UI แยกชื่อชัด
