# Milestone D — Production Hardening

Status: **completed** (2026-07-21)  
Depends on: **Milestone A + B + C** พื้นฐานพร้อม (หรือ C มี polling fallback + blocker ชัด)  
Next: **Milestone E** (System + Audit Logs เต็มรูปแบบ)

---

## Goal

ทำให้ Account Security + Support Cases + Chat พร้อมขึ้น production: แจ้งเตือน, ยกเลิก session, retention, spam protection, และตรวจความปลอดภัยซ้ำ

---

## Scope

### 1. Notifications

- ถ้ามี email provider → ส่งเมื่อมีคำตอบในเคส/แชท, สถานะเคสเปลี่ยน, รหัสผ่านถูกเปลี่ยน/รีเซ็ต
- ถ้ายังไม่มี provider → ทำ `NotificationAdapter` + console/dev stub และบันทึก blocker ใน `goal.md`
- In-app notification bell สำหรับ Admin (อย่างน้อยรายการล่าสุด)

### 2. Session revocation

- ใช้ `authVersion` ให้ครบทุกจุดที่เปลี่ยนรหัส / PIN / admin reset
- บังคับ re-login เมื่อ `mustChangePassword` / `mustChangeSecurityPin`

### 3. Data retention

- นโยบายลบหรือ hash IP / ข้อมูลติดต่อชั่วคราว (เช่น 7–30 วัน)
- script/job ที่รันซ้ำได้ (dry-run ได้)
- อย่าเก็บ MAC; อย่าเก็บ plain token ของ public case

### 4. Spam & concurrency

- rate limit เสริม, blocklist / ทำเครื่องหมาย spam
- กันเคลมเคสซ้ำ / race (ยืนยันจาก B)
- CAPTCHA/Turnstile ผูกจริงถ้ายังเป็น stub

### 5. Admin UX

- SLA badge (เช่น เคสใหม่เกิน X นาทียังไม่มีคนรับ)
- priority ใช้งานจริงในคิว
- ลิงก์จากเคส ↔ แชท ↔ โปรไฟล์ user (เมื่อมี)

### 6. Security review ในโค้ด

- ไม่มี plain text secret ใน DB/log
- public case token แข็งแรงพอ
- admin identity masking ฝั่ง user ยังถูกต้อง
- support/chat แยกจาก event ownership ชัดเจน (admin ห้าม mutate การ์ดคนอื่นผ่านช่องทางใหม่)
- จุดเรียก audit ที่มีจาก A–C ยังเขียนได้ (Milestone E จะขยาย UI/SystemLog/retention ของ log)

### 7. Tests

- concurrency / claim race
- retention dry-run
- notification adapter hooks
- regression A/B/C

---

## Out of scope

- ฟีเจอร์ผลิตภัณฑ์ใหม่ที่ไม่เกี่ยวกับ hardening
- Payment / marketplace checkout

---

## Done criteria

- [ ] Notification path มีอย่างน้อย adapter + จุดเรียกที่ถูกต้อง
- [ ] authVersion / force-change ครอบคลุมจุดเสี่ยง
- [ ] retention script มีและ document วิธีรัน
- [ ] spam/rate-limit/claim guards ผ่าน test
- [ ] `npm test` + `npm run build` ผ่าน
- [ ] `goal.md` อัปเดต Evidence + Blocked ที่เหลือจริง
- [ ] สรุป production readiness

---

## Risks

- Email provider ยังไม่เลือก → อย่าจำลองว่าส่งเมลจริงแล้ว
- Retention ลบข้อมูลเร็วเกินไปก่อนปิดเคส — เก็บ metadata ที่จำเป็นไว้
