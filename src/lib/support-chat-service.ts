import type { SupportMessageVisibility } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { writeAudit } from "@/lib/audit-log";
import { SUPPORT_MESSAGE_MAX_LENGTH } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { notifyUser } from "@/lib/notification-adapter";
import { sanitizeText } from "@/lib/sanitize";

type Actor = { id: string; email: string; role: string; name?: string | null };

/** ป้ายชื่อผู้ตอบฝั่ง admin — user ห้ามเห็นชื่อจริง */
function adminLabel(sender: { name: string | null; email: string } | null): string {
  if (!sender) return "Admin";
  return `Admin (${sender.name || sender.email})`;
}

/** 1 user = 1 conversation (unique userId) — race-safe ด้วย upsert */
export async function getOrCreateConversation(user: Actor) {
  const existing = await prisma.supportConversation.findUnique({
    where: { userId: user.id },
  });
  if (existing) return existing;

  const conversation = await prisma.supportConversation.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.CHAT_CONVERSATION_CREATE,
    actor: { userId: user.id, role: user.role, email: user.email },
    resourceType: "conversation",
    resourceId: conversation.id,
    summaryTh: "เปิดห้องแชทกับเจ้าหน้าที่",
  });
  return conversation;
}

/** ข้อความฝั่ง user — ซ่อน INTERNAL + ปกปิดชื่อ admin เป็น "เจ้าหน้าที่" */
export async function listMessagesForUser(params: {
  conversationId: string;
  userId: string;
}) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: params.conversationId },
    select: { id: true, userId: true },
  });
  if (!conversation || conversation.userId !== params.userId) {
    return { error: "not_found" as const };
  }

  const messages = await prisma.supportMessage.findMany({
    where: { conversationId: conversation.id, visibility: "PUBLIC" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      senderType: true,
      body: true,
      createdAt: true,
    },
  });

  await prisma.supportConversation.update({
    where: { id: conversation.id },
    data: { userUnreadCount: 0 },
  });

  return {
    messages: messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      from: m.senderType === "USER" ? "คุณ" : "เจ้าหน้าที่",
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function sendUserMessage(params: {
  conversationId: string;
  user: Actor;
  body: string;
}) {
  const body = sanitizeText(params.body).trim().slice(0, SUPPORT_MESSAGE_MAX_LENGTH);
  if (!body) return { error: "empty" as const };

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: params.conversationId },
    select: { id: true, userId: true },
  });
  if (!conversation || conversation.userId !== params.user.id) {
    return { error: "not_found" as const };
  }

  const message = await prisma.supportMessage.create({
    data: {
      conversationId: conversation.id,
      senderType: "USER",
      senderUserId: params.user.id,
      visibility: "PUBLIC",
      body,
    },
  });
  await prisma.supportConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      adminUnreadCount: { increment: 1 },
    },
  });
  await writeAudit({
    action: AUDIT_ACTIONS.CHAT_MESSAGE_SEND,
    actor: { userId: params.user.id, role: params.user.role, email: params.user.email },
    resourceType: "conversation",
    resourceId: conversation.id,
    summaryTh: "ส่งข้อความหาเจ้าหน้าที่",
    metadata: { messageId: message.id },
  });
  return { ok: true as const, messageId: message.id };
}

// ---------------------------------------------------------------------------
// Admin side
// ---------------------------------------------------------------------------

export async function listAdminInbox(params: { page: number; limit: number }) {
  const [total, rows] = await Promise.all([
    prisma.supportConversation.count(),
    prisma.supportConversation.findMany({
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true,
        lastMessageAt: true,
        adminUnreadCount: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        messages: {
          where: { visibility: "PUBLIC" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, senderType: true, createdAt: true },
        },
      },
    }),
  ]);

  return {
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
    conversations: rows.map((c) => ({
      id: c.id,
      user: c.user,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      adminUnreadCount: c.adminUnreadCount,
      lastMessage: c.messages[0]
        ? {
            body: c.messages[0].body.slice(0, 120),
            senderType: c.messages[0].senderType,
          }
        : null,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

/** ฝั่ง admin เห็นทุกข้อความรวม INTERNAL + ชื่อจริงของ admin ผู้ส่ง */
export async function listMessagesForAdmin(conversationId: string) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!conversation) return { error: "not_found" as const };

  const messages = await prisma.supportMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      senderType: true,
      visibility: true,
      body: true,
      createdAt: true,
      sender: { select: { name: true, email: true } },
    },
  });

  await prisma.supportConversation.update({
    where: { id: conversationId },
    data: { adminUnreadCount: 0 },
  });

  return {
    user: conversation.user,
    messages: messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      visibility: m.visibility,
      from:
        m.senderType === "USER"
          ? conversation.user.name || conversation.user.email
          : adminLabel(m.sender),
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function sendAdminMessage(params: {
  conversationId: string;
  admin: Actor;
  body: string;
  visibility: SupportMessageVisibility;
}) {
  const body = sanitizeText(params.body).trim().slice(0, SUPPORT_MESSAGE_MAX_LENGTH);
  if (!body) return { error: "empty" as const };

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: params.conversationId },
    select: { id: true, userId: true },
  });
  if (!conversation) return { error: "not_found" as const };

  const message = await prisma.supportMessage.create({
    data: {
      conversationId: conversation.id,
      senderType: "ADMIN",
      senderUserId: params.admin.id,
      visibility: params.visibility,
      body,
    },
  });
  await prisma.supportConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      ...(params.visibility === "PUBLIC"
        ? { userUnreadCount: { increment: 1 } }
        : {}),
    },
  });

  if (params.visibility === "PUBLIC") {
    await notifyUser({
      userId: conversation.userId,
      title: "เจ้าหน้าที่ตอบกลับข้อความของคุณ",
      body: body.slice(0, 120),
      href: "/support/chat",
    });
  }

  await writeAudit({
    action: AUDIT_ACTIONS.CHAT_MESSAGE_SEND,
    actor: { userId: params.admin.id, role: params.admin.role, email: params.admin.email },
    resourceType: "conversation",
    resourceId: conversation.id,
    summaryTh:
      params.visibility === "PUBLIC"
        ? "เจ้าหน้าที่ตอบข้อความผู้ใช้"
        : "เจ้าหน้าที่เพิ่มโน้ตภายในแชท",
    metadata: { messageId: message.id },
  });
  return { ok: true as const, messageId: message.id };
}
