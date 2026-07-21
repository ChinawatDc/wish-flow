import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addAdminMessage,
  addGuestMessage,
  claimCase,
  createContactCase,
  getCaseByToken,
  listAdminCases,
  patchCase,
} from "@/lib/support-case-service";

const hasDb = Boolean(process.env.DATABASE_URL);

type Actor = { id: string; email: string; role: string };

async function makeAdmin(prefix: string): Promise<Actor> {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@test.local`,
      name: prefix,
      role: "ADMIN",
    },
  });
  return { id: user.id, email: user.email, role: user.role };
}

describe.runIf(hasDb)("support-case integration", () => {
  const userIds: string[] = [];
  const caseIds: string[] = [];
  let admin1: Actor;
  let admin2: Actor;
  let caseId = "";
  let accessToken = "";

  beforeAll(async () => {
    admin1 = await makeAdmin("case-admin1");
    admin2 = await makeAdmin("case-admin2");
    userIds.push(admin1.id, admin2.id);

    const created = await createContactCase({
      name: "ผู้แจ้งทดสอบ",
      subject: "เข้าสู่ระบบไม่ได้",
      detail: "ลืมรหัสผ่านและอีเมลผูกไว้เข้าไม่ได้แล้วครับ",
      contactEmail: `guest-${randomUUID()}@test.local`,
      ipHash: "test-ip-hash",
      deviceId: randomUUID(),
    });
    expect("case" in created).toBe(true);
    if (!("case" in created) || !created.case || !created.accessToken) return;
    caseId = created.case.id;
    accessToken = created.accessToken;
    caseIds.push(caseId);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { resourceId: { in: caseIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.supportCase.deleteMany({ where: { id: { in: caseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("token ใน DB เป็น hash — ไม่ใช่ค่า plain", async () => {
    const db = await prisma.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(db.publicAccessTokenHash).not.toBe(accessToken);
    expect(db.publicAccessTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("เปิดเคสด้วย token ถูกต้องได้ / token ผิดหรือไม่มีเปิดไม่ได้", async () => {
    const ok = await getCaseByToken({ caseId, token: accessToken });
    expect(ok).toBeTruthy();
    expect(ok?.subject).toContain("เข้าสู่ระบบไม่ได้");

    expect(await getCaseByToken({ caseId, token: "wrong-token" })).toBeNull();
    expect(await getCaseByToken({ caseId, token: "" })).toBeNull();
  });

  it("claim กันรับซ้ำ — คนที่สองได้ already_claimed", async () => {
    const first = await claimCase({ caseId, admin: admin1 });
    expect(first).toEqual({ ok: true });

    const second = await claimCase({ caseId, admin: admin2 });
    expect(second).toEqual({ error: "already_claimed" });

    const db = await prisma.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(db.assignedAdminId).toBe(admin1.id);
    expect(db.status).toBe("CLAIMED");
  });

  it("internal note ถูกซ่อนจากฝั่ง public, public reply มองเห็น", async () => {
    const note = await addAdminMessage({
      caseId,
      admin: admin1,
      body: "โน้ตภายใน: ผู้ใช้คนนี้เคยแจ้งมาแล้ว",
      visibility: "INTERNAL",
    });
    expect("ok" in note && note.ok).toBe(true);

    const reply = await addAdminMessage({
      caseId,
      admin: admin1,
      body: "เรากำลังตรวจสอบให้ครับ",
      visibility: "PUBLIC",
    });
    expect("ok" in reply && reply.ok).toBe(true);

    const guestView = await getCaseByToken({ caseId, token: accessToken });
    expect(guestView).toBeTruthy();
    const bodies = guestView!.messages.map((m) => m.body);
    expect(bodies.some((b) => b.includes("กำลังตรวจสอบ"))).toBe(true);
    expect(bodies.some((b) => b.includes("โน้ตภายใน"))).toBe(false);
    // ฝั่ง public ไม่เห็นชื่อ admin จริง
    for (const m of guestView!.messages) {
      expect(m.from === "คุณ" || m.from === "เจ้าหน้าที่").toBe(true);
      expect(m.from).not.toContain(admin1.email);
    }
  });

  it("guest ตอบกลับผ่าน token ได้ และ WAITING_USER → IN_PROGRESS", async () => {
    const dbBefore = await prisma.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(dbBefore.status).toBe("WAITING_USER"); // จาก public reply ก่อนหน้า

    const result = await addGuestMessage({
      caseId,
      token: accessToken,
      body: "ขอบคุณครับ รอคำตอบอยู่",
    });
    expect("ok" in result && result.ok).toBe(true);

    const dbAfter = await prisma.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(dbAfter.status).toBe("IN_PROGRESS");

    const wrongToken = await addGuestMessage({
      caseId,
      token: "invalid",
      body: "hack",
    });
    expect(wrongToken).toEqual({ error: "not_found" });
  });

  it("ปิดเคสแล้ว guest ตอบไม่ได้ + audit close", async () => {
    const patched = await patchCase({ caseId, admin: admin1, status: "CLOSED" });
    expect(patched).toEqual({ ok: true });

    const db = await prisma.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(db.closedAt).toBeTruthy();

    const blocked = await addGuestMessage({
      caseId,
      token: accessToken,
      body: "ยังอยู่ไหม",
    });
    expect(blocked).toEqual({ error: "closed" });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "SUPPORT.CASE_CLOSE", resourceId: caseId },
    });
    expect(audit).toBeTruthy();
  });

  it("list admin cases filter ตามสถานะได้", async () => {
    const closed = await listAdminCases({ status: "CLOSED", page: 1, limit: 50 });
    expect(closed.cases.some((c) => c.id === caseId)).toBe(true);

    const newOnes = await listAdminCases({ status: "NEW", page: 1, limit: 50 });
    expect(newOnes.cases.some((c) => c.id === caseId)).toBe(false);
  });
});
