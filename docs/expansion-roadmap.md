# Wish-Flow Expansion Roadmap

แปลง Wish-Flow จาก "เว็บอวยพรวันเกิด" ไปสู่ **Personal Micro-site Generator**
โดย reuse โครงหลักเดิม:

`create event -> event id/pin -> QR/link -> guest unlock/view by template`

---

## 1) เป้าหมายการขยาย

1. เพิ่ม use case ใหม่โดยใช้โครงเดิมให้มากที่สุด
2. เพิ่มรายได้/คุณค่าผู้ใช้ผ่าน template ที่หลากหลาย
3. คุมความเสี่ยงด้วย rollout แบบ incremental (ง่าย -> ยาก)
4. ไม่ทำให้ flow เดิมของ HBD พัง

---

## 2) Expansion Tracks

## Track A: Template-only Expansion (เร็วที่สุด)

เพิ่มแถวใหม่ใน `templates` + `steps_schema` (reuse step registry เดิม)

- การ์ดขอโทษ
- Anniversary / ครบรอบ
- การ์ดขอบคุณลูกค้า
- Memory slideshow
- Long-distance love page
- Baby announcement / gender reveal

**ผลกระทบระบบ:** ต่ำ (ส่วนใหญ่เป็น content + composition)

## Track B: Logic-light Expansion (ง่ายและ impact สูง)

### Time Capsule (แนะนำอันดับ 1)

แนวคิด: สร้างข้อความ/รูปวันนี้ แต่เปิดได้หลังวันเวลาที่กำหนด

ใช้โครง PIN + QR + unlock เดิม และเพิ่มกติกาเวลา:

- ก่อนถึงเวลาเปิด -> verify-pin ได้หรือไม่ (เลือก policy) แต่ `view` ยังไม่ให้เห็นเนื้อหา
- ถึงเวลาแล้ว -> guest flow ปกติ

**ทางเลือก implementation**

1. **Fast Path (ไม่เปลี่ยน schema):** ใช้ `expires_at` เป็นเวลาเปิด (unlock_at ชั่วคราว)
2. **Clean Path (แนะนำระยะกลาง):** เพิ่ม `unlock_at` ใหม่ผ่าน Prisma migration เพื่อความชัดเจน semantic

## Track C: Interactive Expansion (กลาง-ใหญ่)

- Proposal page (เพิ่ม step แบบ yes/no interaction)
- Wedding Invitation (RSVP, map, registry links)
- เปิดกล่องของขวัญเสมือน (gift-unbox experience)

**ผลกระทบ:** เพิ่ม step types และ validation/UI config

## Track D: Feature Expansion (ใหญ่)

- Wedding Guestbook ดิจิทัล (guest write-back + moderation + realtime)

**ผลกระทบ:** เพิ่มโมดูลข้อมูลใหม่ (guest entries), policy/moderation, realtime updates

## Track E: New Product Angle (กลาง-ใหญ่)

- Digital Business Card (ปรับโทน/IA เป็น professional profile page)
- อาจ spin-off เป็น product line แยก

---

## 3) Priority Recommendation (ง่าย -> ยาก)

1. **Time Capsule (Track B)**
2. **Template-only ชุดแรก (Track A)**
3. **Proposal/Baby reveal (Track C บางส่วน)**
4. **Wedding Guestbook (Track D)**
5. **Digital Business Card (Track E)**

เหตุผล:

- ข้อ 1-2 ใช้โครงเดิมได้เกือบทั้งหมด
- ข้อ 3 ต้องเพิ่ม step interaction และ config depth
- ข้อ 4 ต้องเพิ่ม subsystem ใหม่ชัดเจน
- ข้อ 5 มีโอกาสแยก product/positioning

---

## 4) Web Product Plan (นำไปใช้กับหน้าเว็บ)

## 4.1 Creator UX Changes

### Create Event (`/`)

- เพิ่มตัวเลือก `Event Type`:
  - birthday (default)
  - anniversary
  - apology
  - thank-you
  - time-capsule
  - proposal
  - wedding-invite

> ในระยะแรกยัง map กับ template category/tag ได้ โดยไม่ต้องบังคับ schema ใหม่ทันที

### Edit Event (`/events/[id]/edit`)

- Section พื้นฐาน:
  - ชื่อ
  - วันที่
  - PIN/QR (เดิม)
- Section template:
  - filter ตาม event type
- Section schedule (ใหม่สำหรับ time-capsule):
  - "เปิดได้เมื่อ"
  - timezone
  - policy ก่อนเวลาเปิด (อ่านข้อความแจ้งเตือนอย่างเดียว / รอเวลา)

### Events List (`/events`)

- เพิ่ม badge event type
- เพิ่มสถานะเวลา:
  - scheduled
  - available
  - expired (ถ้ามี)

## 4.2 Guest UX Changes

### Guest PIN (`/e/[id]`)

- ถ้า event เป็น time-capsule และยังไม่ถึงเวลา:
  - แสดง countdown + ข้อความจากเจ้าของ (optional teaser)
  - ไม่แสดง template data จริง

### Guest View (`/e/[id]/view`)

- gating ตามเวลา + unlock token
- ถึงเวลาแล้วทำงานเหมือน flow ปัจจุบัน

---

## 5) API and Domain Changes (Proposed)

## 5.1 No-schema-first phase

- ใช้ metadata/flags จาก `template` และ `event` เดิม
- เพิ่ม validation logic ฝั่ง service:
  - ตรวจ availability window ก่อนส่ง template_data

## 5.2 Recommended schema evolution phase

เมื่อเริ่ม scale use cases แนะนำเพิ่มฟิลด์ผ่าน Prisma migration:

- `events.event_type` (enum/string)
- `events.unlock_at` (timestamp with timezone)
- `events.visibility_policy` (optional)

และเพิ่ม query filters:

- `GET /api/templates?eventType=...`
- `GET /api/events?eventType=...`

---

## 6) Security / Policy Considerations

1. Time Capsule ต้องกัน bypass จาก route ตรง (`/view`) แม้ PIN ถูก
2. ต้อง log access attempts ทั้งช่วงก่อนและหลังเวลาเปิด
3. ยังคงใช้นโยบายเดิม:
   - PIN hash
   - rate limit
   - ownership ผ่าน device_token
   - short-lived unlock token
4. สำหรับ guestbook ในอนาคต:
   - anti-spam
   - moderation queue
   - report/remove flow

---

## 7) Milestones (Execution Plan)

## M1 — Time Capsule MVP

- UI: ตั้งเวลาเปิด + countdown guest page
- Service: availability gating
- API tests: before/after unlock window
- Build + regression tests

## M2 — New Template Packs

- Apology / Anniversary / Thank-you / Memory
- seed templates + preview assets + metadata
- tracking adoption ต่อ template

## M3 — Interactive Packs

- Proposal + Baby reveal + optional new step types
- config options ใน Template Studio (อ้างอิง `docs/template-studio-ia.md`)

## M4 — Wedding Guestbook

- guest response model + APIs + moderation
- realtime feed (polling/websocket ตามงบ complexity)

## M5 — Product Split Validation

- ทดลอง Digital Business Card package
- วัด retention และ conversion เทียบกับ event type อื่น

---

## 8) Success Metrics

1. สัดส่วน event ที่ไม่ใช่ birthday ต่อสัปดาห์
2. template adoption rate แยกตาม event type
3. guest unlock success rate (ก่อน/หลังเพิ่ม use case)
4. completion rate ของ step flow
5. creator repeat rate (สร้าง event มากกว่า 1 ครั้ง)

---

## 9) Risks and Mitigations

1. **Naming/semantic debt** ถ้าใช้ `expires_at` เป็น unlock time นานเกินไป
   - Mitigation: วาง migration ไป `unlock_at` ใน M2/M3
2. **Template quality inconsistency** เมื่อเพิ่มเยอะเร็ว
   - Mitigation: ใช้ publish quality gate จาก Template Studio IA
3. **Scope creep** จาก feature ใหม่หลายโดเมน
   - Mitigation: lock roadmap ตาม M1 -> M5
4. **UX complexity**
   - Mitigation: progressive disclosure (Basic/Pro/Expert)

---

## 10) Immediate Next Actions

1. เลือก policy ของ Time Capsule:
   - verify-pin ก่อนเวลาเปิดได้หรือไม่
   - แสดง teaser อะไรได้บ้าง
2. ทำ spec API behavior matrix (before unlock / after unlock / expired)
3. เลือก template pack แรก 3 แบบจาก Track A
4. เริ่ม M1 implementation โดยไม่แตะ schema ก่อน
5. เก็บ feedback 1 รอบ แล้วค่อยตัดสินใจ migration `unlock_at`

