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
- ห้ามเก็บรูป base64/binary ใน Postgres — ผ่าน `StorageAdapter` (`src/lib/storage.ts`) เท่านั้น, metadata ใน `event_assets`
- อัปโหลดต้องผ่าน `validateUpload` (magic bytes + MIME + ext + ≤5MB) และตั้งชื่อไฟล์ใหม่เป็น UUID
- วันที่ใน DB/API เป็น ISO/ค.ศ. เสมอ — แปลง พ.ศ. เฉพาะ UI ผ่าน `src/lib/thai-date.ts`
- Template ใหม่ = config ใน `prisma/seed.ts` ประกอบจาก step registry — ห้ามเขียน component ต่อ template
- Template query API ต้อง validate + จำกัด limit (≤24)
- ห้ามเชื่อ identity จาก client body — ใช้ `device_token` จาก httpOnly cookie เท่านั้น
- Creator mutation ต้องเช็ค ownership ทุก request
- Guest `view` ต้องมี short-lived unlock token หลัง verify-pin สำเร็จ
- Event id เป็น UUID ไม่ใช่ auto-increment
- Template ต้องผ่าน `steps_schema` + `StepRenderer` — ห้าม hardcode field HBD ในหน้า guest
- Schema ตรง `docs/system-design.md` §5 (creators, templates, events, event_access_logs, event_assets)
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
