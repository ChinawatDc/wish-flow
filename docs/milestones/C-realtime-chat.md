# Milestone C — Realtime Chat (User ↔ Admin)

Status: **completed** (2026-07-21)  
Depends on: **Milestone A + B** เสร็จและ test/build ผ่าน  
Blocks: Milestone D (notification/realtime hardening เต็ม)

---

## Goal

ให้ **user ที่ login แล้ว** คุยกับเจ้าหน้าที่แบบ realtime โดย:

- 1 user มีได้แค่ **1 conversation** หลัก
- Admin ทุกคนเห็นแชททั้งหมด
- User เห็นผู้ตอบเป็น **「เจ้าหน้าที่」** เท่านั้น
- Admin เห็นชื่อจริง เช่น `Admin (สมชาย)` — เฉพาะฝั่ง admin

แยกจาก SupportCase ของคนที่ login ไม่ได้ (Milestone B) แต่เชื่อมเคสได้ถ้าจำเป็น

---

## Infrastructure (เลือกแบบ production-safe)

โปรเจกต์อยู่บน Next.js / Vercel:

1. **บันทึกข้อความลง Neon/Postgres ก่อนเสมอ**
2. Realtime แนะนำ **Ably หรือ Pusher** (ไม่ใช่ Socket.IO บน serverless เป็นทางหลัก)
3. ถ้ายังไม่มี provider keys → ทำ persistence + API + UI ให้ครบ แล้วใช้ **polling 3–5s** เป็น fallback และบันทึก blocker ชัดเจน
4. Webhook ใช้ได้สำหรับแจ้งเตือนภายนอก — **ไม่ใช่** realtime ไปยัง browser โดยตรง

ห้าม claim ว่า realtime เสร็จถ้ายังเป็น mock อย่างเดียว

---

## Scope

### 1. Schema

- `SupportConversation` — unique `userId` (1 ต่อ user)
- `SupportMessage` — `body`, `senderType` (`USER` | `ADMIN` | `SYSTEM`), `senderUserId`, `visibility` (`PUBLIC` | `INTERNAL`)
- read receipts / unread counters
- optional `supportCaseId` link ไป Milestone B

### 2. Backend rules

- ทุก message authorize server-side
- USER ส่งได้เฉพาะ conversation ของตัวเอง
- ADMIN อ่าน/ตอบได้ทุก conversation
- `INTERNAL` ห้ามส่งให้ user
- sanitize + rate limit
- ไฟล์แนบ (ถ้ามี) ผ่าน `StorageAdapter` + `validateUpload`

### 3. Realtime

- publish event **หลัง** commit DB สำเร็จ
- channel auth: user เข้าได้เฉพาะห้องตัวเอง; admin เข้า lobby/all
- reconnect + fallback polling

### 4. UI

| Path | ผู้ใช้ |
|------|--------|
| `/messages` หรือ `/support/chat` | User |
| `/admin/inbox` | Admin |

- unread badge, mobile-first, ภาษาไทย
- typing indicator ทำได้ถ้าไม่ซับซ้อนเกิน

### 5. APIs (อย่างน้อย)

| Method | Path |
|--------|------|
| GET/POST | `/api/support/conversations` (user: get-or-create ของตัวเอง) |
| GET/POST | `/api/support/conversations/:id/messages` |
| GET | `/api/admin/inbox` |
| GET/POST | `/api/admin/inbox/:id/messages` |
| POST | `/api/realtime/auth` (ถ้าใช้ Ably/Pusher) |

---

## Out of scope (ห้ามทำเกินใน C)

- Email provider เต็มระบบ (ทำใน D ถ้าพร้อม)
- Retention job เต็มรูปแบบ (D)
- เปลี่ยนกติกา Security PIN / case public จาก A/B นอก regression fix

---

## Done criteria

- [ ] 1 user = 1 conversation (unique + test)
- [ ] User มองไม่เห็นชื่อ admin จริง; Admin เห็นชื่อ admin จริง
- [ ] Internal messages ถูกซ่อนจาก user
- [ ] Unauthorized access ถูกบล็อก
- [ ] Persistence ใน DB ครบ; realtime หรือ polling fallback ทำงานจริง
- [ ] ถ้าติด Ably/Pusher keys → บันทึก blocker ใน `goal.md` § Blocked ห้ามจำลองว่าเสร็จ
- [ ] `npm test` + `npm run build` ผ่าน
- [ ] อัปเดต docs + `goal.md` Evidence

---

## Risks

- Socket.IO บน Vercel serverless มักไม่เหมาะ → อย่าบังคับถ้าทำให้ deploy พัง
- ชื่อ admin หลุดไปฝั่ง user payload
- Race สร้าง conversation ซ้ำ → unique constraint + get-or-create transaction
