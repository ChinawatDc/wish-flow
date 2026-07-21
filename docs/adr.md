# Architecture Decisions — Wish-Flow

## ADR-1: UI Library สำหรับปฏิทินและ component

**ตัดสินใจ:** ไม่ใช้ MUI/Ant Design — เขียน component เองด้วย TailwindCSS (แนวเดียวกับ shadcn/ui คือ copy-in component ที่เราคุมโค้ดเองทั้งหมด)

**เหตุผล:**
- MUI/Ant มาพร้อม design language ของตัวเอง ปรับให้เข้าธีมการ์ตูนพาสเทล + ฟอนต์ Mali ต้อง override เยอะ และเพิ่ม bundle size มาก
- ปฏิทิน พ.ศ. ต้อง custom ลึก (ปีใน dropdown, caption, format) — เขียนเองตรงไปตรงมากว่า
- `ThaiDatePicker` ของเราเป็น dependency-free, ~200 บรรทัด, คุมได้ 100%

**ผลที่ตามมา:** ถ้าภายหลังต้องการ date-range หรือ features ซับซ้อน ค่อยพิจารณา `react-day-picker` v9 (custom formatters รองรับ พ.ศ. ได้)

## ADR-2: Buddhist calendar — แปลงเฉพาะชั้น UI

**ตัดสินใจ:** ฐานข้อมูล + API ทั้งหมดใช้ ISO/Gregorian (`2026-07-21`) — แปลงเป็น พ.ศ. (`21-07-2569`) เฉพาะตอนแสดงผล ผ่าน `src/lib/thai-date.ts`

**เหตุผล:**
- Date ใน DB ต้อง sort/filter/compare ได้มาตรฐาน
- พ.ศ. = ค.ศ. + 543 เป็น presentation concern ล้วนๆ
- ถ้าเก็บ พ.ศ. ใน DB จะเกิด bug ทุกครั้งที่ integrate กับระบบอื่น

**การทดสอบ:** unit test แปลงไปกลับ, leap year, format ผิด ครอบคลุมใน `thai-date.test.ts`

## ADR-3: Storage adapter สำหรับรูปภาพ

**ตัดสินใจ:** interface `StorageAdapter` (`save` / `delete` / `read`) ใน `src/lib/storage.ts` — MVP ใช้ `LocalStorageAdapter` เก็บที่ `uploads/events/<eventId>/<uuid>.<ext>` เสิร์ฟผ่าน route `/api/uploads/[...path]`

**เหตุผล:**
- ห้ามเก็บ binary ใน PostgreSQL (ทำ DB บวม, backup ช้า) — DB เก็บเฉพาะ metadata ใน `event_assets`
- เสิร์ฟผ่าน route (ไม่ใช่ `public/`) เพราะ production build ของ Next ไม่เห็นไฟล์ที่อัปโหลดหลัง build และเราคุม Content-Type/Cache ได้
- เปลี่ยนเป็น Supabase Storage / Cloudflare R2 = เขียน adapter ใหม่ตัวเดียว จุดเรียกที่เหลือไม่ต้องแก้

**Security:** ตั้งชื่อไฟล์ใหม่ด้วย UUID, ตรวจ magic bytes + MIME + นามสกุล + ขนาด ≤5MB ฝั่ง server, กัน path traversal ใน `urlToSafePath`

## Backup / Restore

### PostgreSQL

```bash
# backup
docker exec wishflow-postgres pg_dump -U wishflow wish_flow > backup-$(date +%Y%m%d).sql

# restore
docker exec -i wishflow-postgres psql -U wishflow wish_flow < backup-YYYYMMDD.sql
```

### Assets (uploads/)

```bash
# backup
tar czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# restore
tar xzf uploads-backup-YYYYMMDD.tar.gz
```

ควร backup ทั้งสองอย่างพร้อมกันเสมอ (DB อ้างอิง URL ของไฟล์)

### ล้างไฟล์ orphan

```bash
npx tsx scripts/cleanup-orphan-assets.ts --dry-run   # ดูก่อน
npx tsx scripts/cleanup-orphan-assets.ts             # ลบจริง
```
