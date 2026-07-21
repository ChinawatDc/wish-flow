import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminResetPassword,
  adminResetSecurityPin,
  changePassword,
  changeSecurityPin,
  setPassword,
  setSecurityPin,
  verifySecurityPinForStepUp,
} from "@/lib/account-security-service";
import { SECURITY_PIN_MAX_ATTEMPTS } from "@/lib/constants";
import { prisma } from "@/lib/db";

const hasDb = Boolean(process.env.DATABASE_URL);

type Actor = { id: string; email: string; role: string };

async function makeUser(
  prefix: string,
  role: "USER" | "ADMIN" = "USER",
  password?: string,
): Promise<Actor> {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@test.local`,
      name: prefix,
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      role,
    },
  });
  return { id: user.id, email: user.email, role: user.role };
}

describe.runIf(hasDb)("account-security integration", () => {
  const ids: string[] = [];

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { resourceId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  describe("Security PIN set / verify / lockout", () => {
    let admin: Actor;

    beforeAll(async () => {
      admin = await makeUser("pin-admin", "ADMIN");
      ids.push(admin.id);
    });

    it("ตั้ง PIN สำเร็จ เก็บเป็น hash เท่านั้น", async () => {
      const result = await setSecurityPin({ user: admin, pin: "123456" });
      expect(result).toEqual({ ok: true });

      const db = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
      expect(db.securityPinHash).toBeTruthy();
      expect(db.securityPinHash).not.toContain("123456");
      expect(db.securityPinSetAt).toBeTruthy();
    });

    it("ตั้งซ้ำไม่ได้ (ต้องใช้เมนูเปลี่ยน)", async () => {
      const result = await setSecurityPin({ user: admin, pin: "111111" });
      expect(result).toEqual({ error: "already_set" });
    });

    it("PIN ต้องเป็นเลข 6 หลัก", async () => {
      const fresh = await makeUser("pin-format", "ADMIN");
      ids.push(fresh.id);
      expect(await setSecurityPin({ user: fresh, pin: "12345" })).toEqual({
        error: "invalid_pin",
      });
      expect(await setSecurityPin({ user: fresh, pin: "abcdef" })).toEqual({
        error: "invalid_pin",
      });
    });

    it("verify ถูกต้อง → ok + reset failure counter", async () => {
      const result = await verifySecurityPinForStepUp({ user: admin, pin: "123456" });
      expect(result).toEqual({ ok: true });
    });

    it("verify ผิดครบ 5 ครั้ง → ล็อก 15 นาที", async () => {
      for (let i = 0; i < SECURITY_PIN_MAX_ATTEMPTS; i++) {
        const result = await verifySecurityPinForStepUp({
          user: admin,
          pin: "000000",
        });
        expect("error" in result && result.error).toBe("wrong_pin");
      }
      // ครั้งถัดไปถูกล็อกแม้ PIN ถูก
      const locked = await verifySecurityPinForStepUp({ user: admin, pin: "123456" });
      expect("error" in locked && locked.error).toBe("locked");
      if ("error" in locked && locked.error === "locked") {
        expect(locked.retryAfterSeconds).toBeGreaterThan(0);
      }

      // ปลดล็อกให้เทสถัดไป
      await prisma.user.update({
        where: { id: admin.id },
        data: { securityPinLockedUntil: null, securityPinFailedAttempts: 0 },
      });
    });

    it("เปลี่ยน PIN ด้วย PIN เดิม", async () => {
      const wrong = await changeSecurityPin({
        user: admin,
        currentPin: "999999",
        newPin: "654321",
      });
      expect("error" in wrong && wrong.error).toBe("wrong_pin");

      const ok = await changeSecurityPin({
        user: admin,
        currentPin: "123456",
        newPin: "654321",
      });
      expect(ok).toEqual({ ok: true });

      const verify = await verifySecurityPinForStepUp({ user: admin, pin: "654321" });
      expect(verify).toEqual({ ok: true });
    });
  });

  describe("password change / set + authVersion", () => {
    it("เปลี่ยนรหัสผ่าน: ต้องรู้รหัสเดิม และ bump authVersion", async () => {
      const user = await makeUser("pw-user", "USER", "oldpassword1");
      ids.push(user.id);
      const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      const wrong = await changePassword({
        user,
        currentPassword: "wrongwrong",
        newPassword: "newpassword1",
      });
      expect("error" in wrong && wrong.error).toBe("wrong_password");

      const ok = await changePassword({
        user,
        currentPassword: "oldpassword1",
        newPassword: "newpassword1",
      });
      expect(ok).toEqual({ ok: true });

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(after.authVersion).toBe(before.authVersion + 1);
      expect(await bcrypt.compare("newpassword1", after.passwordHash!)).toBe(true);
    });

    it("บัญชี OAuth ไม่มีรหัส → set-password ได้ครั้งเดียว", async () => {
      const user = await makeUser("oauth-user", "USER");
      ids.push(user.id);

      const ok = await setPassword({ user, newPassword: "firstpassword1" });
      expect(ok).toEqual({ ok: true });

      const again = await setPassword({ user, newPassword: "anotherpass1" });
      expect(again).toEqual({ error: "already_has_password" });
    });
  });

  describe("admin reset (self-reset blocked, temp shown once)", () => {
    let admin: Actor;
    let target: Actor;

    beforeAll(async () => {
      admin = await makeUser("reset-admin", "ADMIN", "adminpass123");
      target = await makeUser("reset-target", "USER", "targetpass123");
      ids.push(admin.id, target.id);
    });

    it("admin reset password ตัวเองถูกบล็อก", async () => {
      const result = await adminResetPassword({ actor: admin, targetId: admin.id });
      expect(result).toEqual({ error: "self_reset_blocked" });
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "ADMIN.PASSWORD_RESET",
          actorUserId: admin.id,
          outcome: "DENIED",
        },
      });
      expect(audit).toBeTruthy();
    });

    it("admin reset PIN ตัวเองถูกบล็อก", async () => {
      const result = await adminResetSecurityPin({ actor: admin, targetId: admin.id });
      expect(result).toEqual({ error: "self_reset_blocked" });
    });

    it("reset password คนอื่น → temp password + mustChangePassword + authVersion bump", async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      const result = await adminResetPassword({ actor: admin, targetId: target.id });
      const tempPassword = "tempPassword" in result ? result.tempPassword : undefined;
      expect(tempPassword).toBeTruthy();
      if (!tempPassword) return;

      expect(tempPassword.length).toBeGreaterThanOrEqual(10);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(after.mustChangePassword).toBe(true);
      expect(after.authVersion).toBe(before.authVersion + 1);
      expect(await bcrypt.compare(tempPassword, after.passwordHash!)).toBe(true);
      // ห้ามมี plain temp password ใน DB
      expect(after.passwordHash).not.toContain(tempPassword);
    });

    it("reset security PIN คนอื่น → temp PIN 6 หลัก + mustChangeSecurityPin", async () => {
      const result = await adminResetSecurityPin({ actor: admin, targetId: target.id });
      const tempPin = "tempPin" in result ? result.tempPin : undefined;
      expect(tempPin).toBeTruthy();
      if (!tempPin) return;

      expect(tempPin).toMatch(/^\d{6}$/);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(after.mustChangeSecurityPin).toBe(true);
      expect(after.securityPinHash).toBeTruthy();
      expect(after.securityPinHash).not.toContain(tempPin);
    });
  });

  describe("audit ไม่รั่ว secret", () => {
    it("audit metadata ไม่มี password / pin / token", async () => {
      const logs = await prisma.auditLog.findMany({
        where: { actorUserId: { in: ids } },
      });
      expect(logs.length).toBeGreaterThan(0);
      for (const log of logs) {
        const flat = JSON.stringify(log.metadata ?? {}).toLowerCase();
        expect(flat).not.toContain("password\":");
        expect(flat).not.toContain("pin\":");
        expect(flat).not.toContain("token\":");
        expect(flat).not.toContain("secret\":");
        // ค่าจริงที่ใช้ในเทสต้องไม่โผล่
        expect(flat).not.toContain("123456");
        expect(flat).not.toContain("654321");
        expect(flat).not.toContain("newpassword1");
      }
    });
  });
});
