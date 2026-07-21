# AI Prompt — Support & Account Security (ทำทุก Milestone จนจบ)

คัดลอกบล็อกด้านล่างทั้งก้อนไปวางใน Agent mode เพื่อให้ AI ทำ **A → B → C → D → E** ต่อเนื่องจนจบตามเอกสารใน repo

---

```text
อ่านก่อนเริ่ม (บังคับ):
1. AGENTS.md
2. goal.md
3. flow.md
4. docs/system-design.md
5. docs/adr.md
6. docs/support-ops-milestones.md
7. docs/milestones/A-account-security.md
8. docs/milestones/B-support-cases.md
9. docs/milestones/C-realtime-chat.md
10. docs/milestones/D-hardening.md
11. docs/milestones/E-system-audit-logs.md

Mission: Implement Support & Account Security ครบทุก Milestone ตามลำดับ A → B → C → D → E
ห้ามข้าม foundation และห้ามทำ Milestone ถัดไปจนกว่า Milestone ปัจจุบันจะผ่าน done criteria ในไฟล์ milestone นั้น

กติการ่วมทั้งโปรเจกต์:
- Schema เปลี่ยนผ่าน Prisma migrate เท่านั้น; อย่าทำลายข้อมูลเดิมบน Neon/local
- ห้ามเก็บ password / Security PIN / public case token แบบ plain text — ใช้ bcrypt/argon2 หรือ hash ที่เหมาะสม
- Security PIN ของบัญชี แยกจาก Event PIN ของการ์ด (Event.pinHash) ห้าม reuse
- Creator mutation ใช้ session + ownerUserId; Admin ห้าม mutate การ์ดของ user คนอื่น
- UI ภาษาไทย + mobile-first; อย่ารบกวน guest /e/**
- Auth/session/requireAdmin ที่มีอยู่ให้ reuse
- Audit/System log ห้ามเก็บ secret; แยกจาก event_access_logs และ template_telemetry_events
- หลังจบแต่ละ Milestone: รัน migrate/seed ที่จำเป็น, npm test, npm run build, อัปเดต goal.md checklist + Evidence และอัปเดตสถานะใน docs/support-ops-milestones.md
- ถ้าติด external dependency (Google OAuth, Turnstile, Ably/Pusher, email provider) ให้ทำส่วนที่ทำได้จริง บันทึก Blocked ใน goal.md ชัดเจน ห้ามจำลองว่าเสร็จ
- ถ้าต้องเลือก design: เลือกแบบ production-safe ที่ง่ายสุด แล้วบันทึก ADR สั้น ๆ ใน docs/adr.md

============================================================
Milestone A — Account Security + Profile
ทำตาม docs/milestones/A-account-security.md ให้ครบ
(ถ้าสร้าง AuditLog บางส่วนใน A ให้ออกแบบให้ขยายต่อใน E ได้ อย่าสร้างตารางซ้ำมั่ว)
สรุปสั้น ๆ แล้วไปต่อ B เฉพาะเมื่อ A ผ่าน done criteria
============================================================
Milestone B — Public Contact + Admin Case Management
ทำตาม docs/milestones/B-support-cases.md ให้ครบ
สรุปสั้น ๆ แล้วไปต่อ C เฉพาะเมื่อ B ผ่าน done criteria
============================================================
Milestone C — Realtime Chat
ทำตาม docs/milestones/C-realtime-chat.md ให้ครบ
บน Vercel ห้ามยึด Socket.IO serverless เป็นทางหลัก — ใช้ Ably/Pusher หรือ polling fallback
สรุปสั้น ๆ แล้วไปต่อ D เฉพาะเมื่อ C ผ่าน done criteria (หรือ C พร้อม fallback + blocker ชัด)
============================================================
Milestone D — Hardening
ทำตาม docs/milestones/D-hardening.md ให้ครบ
สรุปสั้น ๆ แล้วไปต่อ E เฉพาะเมื่อ D ผ่าน done criteria (หรือ blocker ที่ไม่บล็อก E)
============================================================
Milestone E — System Log + Audit Log
ทำตาม docs/milestones/E-system-audit-logs.md ให้ครบ
สร้าง/ขยาย AuditLog + SystemLog, wrapper กลาง, /admin/logs, export, retention script, ผูกจุดเรียกจาก A–D
ห้ามเก็บ secret ใน metadata; แยกจาก event_access_logs / template_telemetry_events
============================================================

เมื่อจบทุก Milestone (หรือจบเท่าที่ทำได้เพราะ blocker):
1. อัปเดต goal.md เป็น G7 Support & Account Security พร้อม Evidence
2. อัปเดต flow.md / docs/system-design.md / AGENTS.md ตามที่เปลี่ยนจริง
3. สรุปท้ายงานเดียว: completed / remaining / risks / migrations / test results แยกตาม A B C D E

เริ่มจากตรวจสถานะ repository และวางแผนสั้น ๆ จากนั้น implement ต่อเนื่องจนทุกส่วนที่ทำได้ผ่าน tests และ build
```

---

## คำสั่งทีละ Milestone (ถ้าไม่อยากทำทีเดียว)

ใช้ไฟล์ใน `docs/milestones/` เป็นสเปก แล้วสั่งประมาณนี้:

```text
อ่าน AGENTS.md, goal.md, flow.md, docs/system-design.md และ docs/milestones/A-account-security.md
Implement เฉพาะ Milestone A ให้ผ่าน done criteria แล้วหยุด — อย่าเริ่ม B
อัปเดต goal.md Evidence เมื่อจบ
```

สลับชื่อไฟล์เป็น `B-support-cases.md` / `C-realtime-chat.md` / `D-hardening.md` / `E-system-audit-logs.md` ตามรอบ
