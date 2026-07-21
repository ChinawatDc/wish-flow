# AI Bootstrap Prompt — Wish-Flow

คัดลอกบล็อกด้านล่างวางใน Cursor Agent (Agent mode) เพื่อให้อ่านเอกสารแล้วทำจน G1 เสร็จ

---

## Prompt (copy ทั้งหมด)

```text
/wish-flow-build

อ่านเอกสารเหล่านี้ตามลำดับแล้วลงมือทำจนเสร็จ ห้ามหยุดกลางคันถ้ายังไม่ผ่าน Done Criteria:
1. AGENTS.md
2. goal.md
3. flow.md
4. docs/system-design.md

ภารกิจ: ทำให้ Wish-Flow Phase 1 MVP (G1) เสร็จสมบูรณ์

ข้อบังคับ:
- ทำตาม flow.md §4 Implementation Order ทีละขั้น
- Postgres ผ่าน docker compose ใน repo นี้เท่านั้น (อย่าสมมติ DB ภายนอก)
- รองรับทุกอุปกรณ์: mobile-first, ใช้ได้บนมือถือ/แท็บเล็ต/เดสก์ท็อป
- มีเทส: unit + API integration ยิง Postgres จริงใน Docker
- รัน local ให้ได้: docker compose up -d → migrate → seed → npm run dev
- รันเทสให้ผ่าน: npm test
- Security ตาม AGENTS.md (hash PIN, rate limit, device_token, unlock token)
- Template แบบ lego (steps_schema + StepRenderer) ห้าม hardcode HBD fields
- อัปเดต goal.md checklist + Evidence เมื่อจบ
- จบงานด้วยการรันเองแล้วแปะผล: docker ps / migrate / npm test / npm run build

Done เมื่อทุกข้อใน AGENTS.md → Done Criteria (G1) ติ๊กครบ และ npm test + npm run build ผ่าน
ถ้าติด blocker จริง ให้หยุดเฉพาะเมื่อต้องการ input จากคน และเขียนใน goal.md § Blocked
```

---

## ทางลัดสั้น (ถ้า context มี docs อยู่แล้ว)

```text
ทำตาม AGENTS.md + goal.md + flow.md จน G1 เสร็จ: docker compose Postgres, CRUD+QR+PIN guest, responsive ทุกอุปกรณ์, npm test ผ่าน, อัปเดต goal.md
```
