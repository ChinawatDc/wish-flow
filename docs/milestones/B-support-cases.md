# Milestone B — Public Contact + Admin Case Management

Status: **completed** (2026-07-21)  
Depends on: **Milestone A** เสร็จและ test/build ผ่าน  
Blocks: Milestone C (chat), D (hardening เต็ม)

---

## Goal

ให้คนที่ **login ไม่ได้** ติดต่อเจ้าหน้าที่ได้จากหน้า `/` และให้ Admin จัดการเคสตั้งแต่รับจนปิด โดยยัง **ไม่ทำ** realtime chat ของ user ที่ login

---

## Scope

### 1. Schema

ตารางอย่างน้อย:

- `SupportCase`
- `SupportCaseMessage` (หรือ note)
- `SupportCaseStatusHistory`

สถานะอย่างน้อย:

`NEW` → `CLAIMED` → `IN_PROGRESS` → `WAITING_USER` → `RESOLVED` → `CLOSED` (+ `SPAM`)

ฟิลด์สำคัญของเคส:

| Field | หมายเหตุ |
|-------|----------|
| name, subject, detail | จากฟอร์ม |
| usernameOrEmail | อ้างอิงบัญชี (ถ้ามี) |
| contactEmail, phone | ติดต่อกลับ |
| priority | LOW / NORMAL / HIGH / URGENT |
| assignedAdminId | ผู้รับเคส |
| publicAccessTokenHash | hash ของ token สาธารณะ |
| ipHash | hash + pepper — ห้ามเก็บ MAC |
| deviceId | UUID ใน cookie |
| userAgentDigest | ลดรายละเอียด |
| linkedUserId | optional เมื่อผูกบัญชีได้ |

**ห้ามเก็บ MAC address** (browser ทำไม่ได้และไม่ควรเก็บ)

### 2. Public flow

- ปุ่ม **ติดต่อเจ้าหน้าที่** ที่หน้า `/`
- ฟอร์ม `/support/contact`
- หลังส่งสำเร็จ: แสดง Case ID + access link/token **ครั้งเดียว**
- ติดตามเคส `/support/cases/:id?token=...` — สถานะ + ประวัติตอบกลับที่เปิดเผยได้
- CAPTCHA/Turnstile (หรือ stub ที่พร้อมต่อ) + rate limit ต่อ IP/device
- ห้ามใช้ IP อย่างเดียวเปิดดูเคส

### 3. Admin case console `/admin/support`

- list / search / filter ตามสถานะ / priority / assignee
- **รับเคส (claim)** กันคนรับซ้ำ (transaction / optimistic lock)
- assign, ตอบผู้แจ้ง, **internal note** (user มองไม่เห็น)
- เปลี่ยนสถานะ, ปิดเคส, เปิดเคสใหม่, ทำเครื่องหมาย spam
- เชื่อมเคสเข้ากับบัญชี user ได้ถ้าพบ
- การ reset password จากเคสต้อง **reuse step-up PIN จาก Milestone A** — ห้าม bypass

### 4. APIs (อย่างน้อย)

| Method | Path |
|--------|------|
| POST | `/api/support/contact` |
| GET | `/api/support/cases/:id` (ต้องมี token) |
| POST | `/api/support/cases/:id/messages` (ผู้แจ้งตอบเพิ่มผ่าน token) |
| GET | `/api/admin/support/cases` |
| GET/PATCH | `/api/admin/support/cases/:id` |
| POST | `/api/admin/support/cases/:id/claim` |
| POST | `/api/admin/support/cases/:id/messages` (public reply / internal note) |

### 5. Security / privacy

- sanitize ข้อความทั้งหมด
- ไม่โชว์ internal notes ฝั่ง public
- audit การ claim / close / assign / reset
- UI ภาษาไทย + mobile-first

---

## Out of scope (ห้ามทำใน B)

- Socket.IO / Ably / Pusher realtime chat
- ห้องแชท 1 user = 1 conversation ของ user ที่ login (ทำใน C)

---

## Done criteria

- [ ] Schema + migrate ผ่าน
- [ ] Public contact → ได้ case + token → ติดตามสถานะได้
- [ ] Admin claim / reply / internal note / close ทำงาน
- [ ] Rate limit + token access แน่น; IP อย่างเดียวเปิดเคสไม่ได้
- [ ] Tests: public token, claim race, internal note hidden, step-up reuse สำหรับ reset จากเคส (ถ้ามี)
- [ ] `npm test` + `npm run build` ผ่าน
- [ ] อัปเดต `goal.md` Evidence + docs

---

## Risks

- Token อ่อน / leak ใน referrer → ใช้ token ยาว + hash ใน DB + no-store
- Claim race ระหว่าง admin สองคน
- สับสน SupportCase (guest) กับ SupportConversation (logged-in) ใน C
