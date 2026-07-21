import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  getOrCreateConversation,
  listAdminInbox,
  listMessagesForAdmin,
  listMessagesForUser,
  sendAdminMessage,
  sendUserMessage,
} from "@/lib/support-chat-service";

const hasDb = Boolean(process.env.DATABASE_URL);

type Actor = { id: string; email: string; role: string; name?: string | null };

async function makeUser(
  prefix: string,
  role: "USER" | "ADMIN" = "USER",
): Promise<Actor> {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@test.local`,
      name: prefix === "chat-admin" ? "สมชาย แอดมิน" : prefix,
      role,
    },
  });
  return { id: user.id, email: user.email, role: user.role, name: user.name };
}

describe.runIf(hasDb)("support-chat integration", () => {
  const userIds: string[] = [];
  let user: Actor;
  let stranger: Actor;
  let admin: Actor;
  let conversationId = "";

  beforeAll(async () => {
    user = await makeUser("chat-user");
    stranger = await makeUser("chat-stranger");
    admin = await makeUser("chat-admin", "ADMIN");
    userIds.push(user.id, stranger.id, admin.id);
  });

  afterAll(async () => {
    await prisma.appNotification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.supportConversation.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("1 user = 1 conversation (get-or-create คืนห้องเดิม)", async () => {
    const first = await getOrCreateConversation(user);
    const second = await getOrCreateConversation(user);
    expect(second.id).toBe(first.id);
    conversationId = first.id;

    const count = await prisma.supportConversation.count({
      where: { userId: user.id },
    });
    expect(count).toBe(1);
  });

  it("user ส่งข้อความในห้องตัวเองได้ / ห้องคนอื่นไม่ได้", async () => {
    const ok = await sendUserMessage({
      conversationId,
      user,
      body: "สวัสดีครับ มีปัญหาการ์ดครับ",
    });
    expect("ok" in ok && ok.ok).toBe(true);

    const blocked = await sendUserMessage({
      conversationId,
      user: stranger,
      body: "แอบส่อง",
    });
    expect(blocked).toEqual({ error: "not_found" });

    const blockedRead = await listMessagesForUser({
      conversationId,
      userId: stranger.id,
    });
    expect(blockedRead).toEqual({ error: "not_found" });
  });

  it("user เห็น admin เป็น 「เจ้าหน้าที่」 — admin เห็นชื่อจริง Admin (ชื่อ)", async () => {
    const publicReply = await sendAdminMessage({
      conversationId,
      admin,
      body: "รับเรื่องแล้วครับ เดี๋ยวตรวจสอบให้",
      visibility: "PUBLIC",
    });
    expect("ok" in publicReply && publicReply.ok).toBe(true);

    const userView = await listMessagesForUser({ conversationId, userId: user.id });
    expect("messages" in userView).toBe(true);
    if (!("messages" in userView) || !userView.messages) return;
    const adminMsg = userView.messages.find((m) => m.senderType === "ADMIN");
    expect(adminMsg?.from).toBe("เจ้าหน้าที่");
    // ชื่อ/อีเมล admin จริงห้ามหลุดใน payload ฝั่ง user
    const flat = JSON.stringify(userView);
    expect(flat).not.toContain("สมชาย แอดมิน");
    expect(flat).not.toContain(admin.email);

    const adminView = await listMessagesForAdmin(conversationId);
    expect("messages" in adminView).toBe(true);
    if (!("messages" in adminView) || !adminView.messages) return;
    const fromAdmin = adminView.messages.find((m) => m.senderType === "ADMIN");
    expect(fromAdmin?.from).toBe("Admin (สมชาย แอดมิน)");
  });

  it("INTERNAL ถูกซ่อนจาก user แต่ admin เห็น", async () => {
    const note = await sendAdminMessage({
      conversationId,
      admin,
      body: "โน้ตภายใน: user นี้ VIP",
      visibility: "INTERNAL",
    });
    expect("ok" in note && note.ok).toBe(true);

    const userView = await listMessagesForUser({ conversationId, userId: user.id });
    if (!("messages" in userView) || !userView.messages) {
      throw new Error("expected messages");
    }
    expect(
      userView.messages.some((m) => m.body.includes("โน้ตภายใน")),
    ).toBe(false);

    const adminView = await listMessagesForAdmin(conversationId);
    if (!("messages" in adminView) || !adminView.messages) {
      throw new Error("expected messages");
    }
    expect(
      adminView.messages.some(
        (m) => m.visibility === "INTERNAL" && m.body.includes("โน้ตภายใน"),
      ),
    ).toBe(true);
  });

  it("admin PUBLIC reply สร้าง in-app notification ให้ user", async () => {
    const notif = await prisma.appNotification.findFirst({
      where: { userId: user.id },
    });
    expect(notif).toBeTruthy();
    expect(notif?.href).toBe("/support/chat");
  });

  it("inbox แสดง conversation พร้อม unread", async () => {
    const inbox = await listAdminInbox({ page: 1, limit: 50 });
    const row = inbox.conversations.find((c) => c.id === conversationId);
    expect(row).toBeTruthy();
    expect(row?.user.email).toBe(user.email);
  });
});
