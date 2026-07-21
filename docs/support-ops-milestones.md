# Support & Account Security — Milestone Index (G7)

แผนเพิ่มความปลอดภัยบัญชี, โปรไฟล์, เคสติดต่อเจ้าหน้าที่, แชท User↔Admin และระบบ Log

**ลำดับบังคับ:** A → B → C → D → E (ห้ามข้าม foundation)

| Milestone | เอกสาร | สรุป |
|-----------|--------|------|
| **A** | [A-account-security.md](./milestones/A-account-security.md) | Security PIN (Admin), step-up, reset password/PIN, `/profile`, เปลี่ยนรหัส |
| **B** | [B-support-cases.md](./milestones/B-support-cases.md) | ติดต่อเจ้าหน้าที่จาก `/`, ติดตามเคส, Admin จัดการเคส |
| **C** | [C-realtime-chat.md](./milestones/C-realtime-chat.md) | 1 user = 1 แชท, Admin inbox, realtime (Ably/Pusher หรือ polling) |
| **D** | [D-hardening.md](./milestones/D-hardening.md) | แจ้งเตือน, retention ข้อมูลติดต่อ, spam, session revoke, security review |
| **E** | [E-system-audit-logs.md](./milestones/E-system-audit-logs.md) | Audit Log + System Log, Admin `/admin/logs`, export, retention script |

**คำสั่ง AI รวมทุก Milestone:** [AI_SUPPORT_OPS_PROMPT.md](./AI_SUPPORT_OPS_PROMPT.md)

---

## หลักการร่วม (ทุก Milestone)

1. อ่าน `AGENTS.md`, `goal.md`, `flow.md`, `docs/system-design.md` ก่อนลงมือ
2. Schema เปลี่ยนผ่าน Prisma migrate เท่านั้น
3. Secret (password / Security PIN / public token) เก็บแค่ hash — ห้าม plain text ใน DB/log
4. **Security PIN ของบัญชี ≠ Event PIN ของการ์ด**
5. Creator mutation ใช้ session + `ownerUserId`; Admin ห้าม mutate การ์ดของ user คนอื่น
6. UI ภาษาไทย + mobile-first; guest `/e/**` ไม่พัง
7. หลังแต่ละ Milestone: migrate/seed (ตามที่จำเป็น) + `npm test` + `npm run build` + อัปเดต `goal.md` Evidence
8. ติด external dependency → ทำส่วนที่ทำได้ + บันทึก Blocked — ห้ามจำลองว่าเสร็จ
9. **Audit/System log ห้ามเก็บ secret**; แยกจาก `event_access_logs` และ `template_telemetry_events`

---

## สถานะรวม

| Milestone | Status |
|-----------|--------|
| A Account Security | **completed** (2026-07-21) |
| B Support Cases | **completed** (2026-07-21) |
| C Realtime Chat | **completed** (2026-07-21 — polling 4s fallback; Ably/Pusher keys ยังไม่มี → ดู goal.md § Blocked) |
| D Hardening | **completed** (2026-07-21 — NotificationAdapter stub + retention scripts; email provider ดู Blocked) |
| E System + Audit Logs | **completed** (2026-07-21 — `/admin/logs`, export CSV/JSON, cleanup script) |
