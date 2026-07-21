# Milestone A — Account Security + Profile

Status: **completed** (2026-07-21)  
Depends on: Auth/RBAC (G5) เสร็จแล้ว  
Blocks: Milestone B, C, D, E

---

## Goal

เพิ่มความปลอดภัยบัญชีและโปรไฟล์ผู้ใช้ โดยแยก **Security PIN ของบัญชี** ออกจาก **Event PIN ของการ์ด** อย่างชัดเจน

---

## Scope

### 1. Schema (Prisma migrate เท่านั้น)

เพิ่มบน `User` (อย่างน้อย):

| Field | หมายเหตุ |
|-------|----------|
| `securityPinHash` | bcrypt — ห้าม plain text |
| `securityPinSetAt` | เวลาตั้ง PIN สำเร็จ |
| `securityPinFailedAttempts` | นับครั้งผิด |
| `securityPinLockedUntil` | lockout ชั่วคราว |
| `mustChangePassword` | บังคับเปลี่ยนหลัง admin reset |
| `mustChangeSecurityPin` | บังคับตั้ง/เปลี่ยน PIN หลัง reset |
| `authVersion` | bump เพื่อ invalidate JWT session เก่า |
| `username` | optional unique |
| `phone` | optional |

เพิ่ม `AuditLog` อย่างน้อยสำหรับการกระทำสำคัญ: reset password/PIN, change password/PIN, role/status  
(ออกแบบให้ขยายต่อใน **Milestone E** ได้ — อย่าสร้างตาราง log ซ้ำมั่ว; E จะเพิ่ม System Log, Admin UI, export, retention)

Migration ต้องไม่ทำลายบัญชีเดิมบน Neon/local

### 2. Admin Security PIN (บังคับเฉพาะ `ADMIN`)

- Admin ที่ยังไม่เคยตั้ง PIN เมื่อเข้าสู่ระบบ → modal บังคับตั้ง PIN + ยืนยัน PIN
- ยังไม่ตั้ง PIN → ห้ามเข้าเมนู admin สำคัญ
- PIN 6 หลัก, hash เท่านั้น, rate limit/lockout เมื่อกรอกผิด

### 3. Step-up auth

- ก่อน reset password/PIN ของ user คนอื่น ต้องยืนยัน Security PIN ของ admin
- หลังยืนยันสำเร็จ → short-lived step-up token (HttpOnly cookie ~5 นาที)
- อย่าส่ง PIN ซ้ำทุก request

### 4. Admin reset

ใน `/admin/users` (หรือรายละเอียดผู้ใช้):

- ปุ่ม **รีเซ็ตรหัสผ่าน**
- ปุ่ม **รีเซ็ต Security PIN**

หลังยืนยัน PIN ของ admin:

1. สุ่มค่าชั่วคราว (`crypto.randomBytes`)
2. เก็บเฉพาะ hash
3. ตั้ง `mustChangePassword` / `mustChangeSecurityPin`
4. bump `authVersion`
5. แสดงค่าชั่วคราวให้ admin เห็น **ครั้งเดียว** (`Cache-Control: no-store`)
6. ห้ามเขียน plain text ลง audit/log/DB
7. ห้าม admin reset รหัสตัวเองผ่าน admin console — ใช้หน้า profile

### 5. Profile (`/profile`) — ผู้ใช้ทุกคน

- แก้ชื่อ, username, phone, รูป (ผ่าน `StorageAdapter` ถ้าทำ)
- อีเมล read-only ในรอบนี้
- เปลี่ยนรหัสผ่าน: รหัสเก่า + ใหม่ + ยืนยันใหม่
- ผู้ใช้ Google ที่ไม่มี `passwordHash`: รองรับ **ตั้งรหัสผ่าน** แยกจาก **เปลี่ยนรหัสผ่าน**
- หลังเปลี่ยนรหัส: bump `authVersion`

### 6. APIs (อย่างน้อย)

| Method | Path |
|--------|------|
| GET/PATCH | `/api/me/profile` |
| POST | `/api/me/change-password` |
| POST | `/api/me/set-password` |
| POST | `/api/me/security-pin` |
| PATCH | `/api/me/security-pin` |
| POST | `/api/admin/step-up/verify-pin` |
| POST | `/api/admin/users/:id/reset-password` |
| POST | `/api/admin/users/:id/reset-security-pin` |

### 7. UI

- ภาษาไทย + mobile-first
- ไม่รบกวน guest routes `/e/**`

---

## Out of scope (ห้ามทำใน A)

- Chat realtime
- Support case / ติดต่อเจ้าหน้าที่แบบ public
- Socket.IO / Ably / Pusher

---

## Done criteria

- [ ] migrate + seed ผ่าน (local และ/หรือ Neon ตามที่ใช้อยู่)
- [ ] Admin ที่ไม่มี PIN ถูกบังคับตั้งก่อนใช้ admin
- [ ] Step-up + reset password/PIN ทำงาน; ค่าชั่วคราวโชว์ครั้งเดียว
- [ ] Profile + change/set password ทำงาน
- [ ] Tests: set/verify PIN, lockout, step-up, reset once-view, change password, OAuth set-password, self-reset ถูกบล็อก, audit ไม่รั่ว secret
- [ ] `npm test` + `npm run build` ผ่าน
- [ ] อัปเดต `goal.md` Evidence + docs ที่เกี่ยวข้อง (AGENTS / flow / system-design / ADR)

---

## Risks

- JWT ไม่ re-read DB ทุก request (ADR-4) → ต้องพึ่ง `authVersion` / force re-login หลัง reset
- อย่าสับสน Security PIN กับ Event PIN
- การโชว์รหัสชั่วคราวให้ admin มีความเสี่ยง — บังคับเปลี่ยนทันทีหลัง login
