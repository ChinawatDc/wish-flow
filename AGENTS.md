# AGENTS.md

## Mission
Build **Wish-Flow** — a micro-site builder for wish/HBD events with QR + PIN unlock.
Deliver a runnable end-to-end system, not partial mockups.

## Read First (ทุกครั้งก่อนลงมือ)
1. `goal.md` — focus goal + done criteria
2. `flow.md` — user flows + implementation order
3. `docs/system-design.md` — schema, API, security, roadmap
4. ไฟล์นี้ — rules ที่ห้ามละเมิด

## Primary Goal
Phase 1 MVP ตาม `goal.md` G1: create → PIN/QR → guest unlock → template steps ทำงานจริงบนทุกอุปกรณ์ + tests ผ่านกับ Postgres ใน Docker

## Priorities
1. correctness (e2e flow ใช้ได้)
2. security (PIN hash, rate limit, ownership)
3. responsive / mobile-first
4. maintainability (template lego, ไม่ hardcode birthday)
5. tests ที่รันซ้ำได้กับ Postgres จริง

## Rules
- ห้ามเก็บ PIN แบบ plain text — ใช้ bcrypt หรือ argon2
- **Security PIN ของบัญชี ≠ Event PIN ของการ์ด** — PIN บัญชี (`users.security_pin_hash`, lockout 5/15 นาที, ใช้ step-up admin) แยกจาก `events.pin_hash` (guest unlock) เด็ดขาด — ห้ามใช้ปนกัน
- Audit/System log เขียนผ่าน `writeAudit`/`writeSystemLog` เท่านั้น + `sanitizeMetadata` — ห้ามมี password/PIN/token/secret ใน log; action มาจาก `src/lib/audit-actions.ts`
- Admin action อ่อนไหว (reset password/PIN ของ user อื่น) ต้องผ่าน step-up (`requireAdminStepUp`, cookie `wf_admin_step_up` 5 นาที) และห้าม reset ของตัวเองผ่าน admin console
- เปลี่ยน/รีเซ็ตรหัสผ่านหรือ PIN → bump `authVersion` เสมอ (invalidate JWT เก่า)
- Creator mutation ต้องใช้ session ผู้ใช้ที่ login แล้ว และ `ownerUserId` ตรงกับ session — ห้ามเชื่อ user id จาก body
- Admin **ห้าม** mutate การ์ดของ user คนอื่น (ดูได้อย่างเดียวผ่าน `/api/admin/events*`)
- ห้ามเก็บรูป base64/binary ใน Postgres — ผ่าน `StorageAdapter` (`src/lib/storage.ts`) เท่านั้น, metadata ใน `event_assets`
- อัปโหลดต้องผ่าน `validateUpload` (magic bytes + MIME + ext + ≤5MB) และตั้งชื่อไฟล์ใหม่เป็น UUID
- วันที่ใน DB/API เป็น ISO/ค.ศ. เสมอ — แปลง พ.ศ. เฉพาะ UI ผ่าน `src/lib/thai-date.ts`
- Template ใหม่ = config ใน `prisma/seed.ts` ประกอบจาก step registry — ห้ามเขียน component ต่อ template
- Template query API ต้อง validate + จำกัด limit (≤24)
- ห้ามเชื่อ identity จาก client body — creator ใช้ session (Auth.js JWT), guest ใช้ unlock cookie; `wf_device_token` ใช้เฉพาะ claim การ์ด legacy ครั้งเดียว
- Creator mutation ต้องเช็ค ownership ทุก request
- Guest `view` ต้องมี short-lived unlock token หลัง verify-pin สำเร็จ
- Event id เป็น UUID ไม่ใช่ auto-increment
- Template ต้องผ่าน `steps_schema` + `StepRenderer` — ห้าม hardcode field HBD ในหน้า guest
- Published `template_versions` immutable — publish ใหม่ห้ามขยับ `events.template_version_id` ของ event เดิม (ADR-5)
- Schema ตรง `docs/system-design.md` §5 + ส่วนอัปเดต (users, accounts, template_versions, template_assets, template_telemetry_events)
- API อย่างน้อยครบ `flow.md` §5 / design §7
- UI mobile-first: ใช้งานได้บนมือถือ, แท็บเล็ต, เดสก์ท็อป
- เปลี่ยน schema ผ่าน Prisma migrate เท่านั้น
- อย่าทำ animation หนักก่อน QR+PIN e2e เขียว
- อย่าข้ามไป Phase 2/3 ก่อน G1 done
- อัปเดต `goal.md` checklist + Evidence เมื่อจบรอบงาน

## Local Stack
- Postgres: `docker compose up -d`
- App: `npm run dev`
- Migrate/seed: `npm run db:migrate && npm run db:seed`
- Test: `npm test` (ต้องมี Postgres รันอยู่)

## Working Style
- ตาม `flow.md` §4 Implementation Order ทีละขั้น
- จบแต่ละขั้น: สรุป what changed / what remains / risks
- ถ้าต้องเลือก design: เลือกแบบ production-safe ที่ง่ายสุด แล้วไปต่อ
- ติด blocker → เขียนใน `goal.md` § Blocked พร้อม input ที่ต้องการ

## Done Criteria (G1)
- [x] `docker compose up -d` แล้ว Postgres healthy
- [x] migrate + seed ผ่าน
- [x] `npm run dev` รันได้
- [x] `npm test` ผ่าน
- [x] Creator CRUD + QR ใช้ได้
- [x] Guest PIN + template view ใช้ได้ + rate limit ทำงาน
- [x] Responsive ตรวจบน viewport มือถืออย่างน้อย
- [x] `npm run build` ผ่าน
