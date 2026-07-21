import { prisma } from "@/lib/db";
import { writeSystemLog } from "@/lib/system-log";

export type NotificationPayload = {
  userId: string;
  title: string;
  body: string;
  href?: string | null;
};

/** ช่องทางส่งแจ้งเตือนภายนอก (email ฯลฯ) — ยังไม่มี provider จริง (goal.md § Blocked) */
export interface NotificationAdapter {
  send(payload: NotificationPayload): Promise<void>;
}

export class ConsoleNotificationAdapter implements NotificationAdapter {
  async send(payload: NotificationPayload): Promise<void> {
    console.info(
      `[notify] user=${payload.userId} title=${payload.title} href=${payload.href ?? "-"}`,
    );
  }
}

export const notificationAdapter: NotificationAdapter =
  new ConsoleNotificationAdapter();

/** สร้าง in-app notification + ส่งผ่าน adapter (fire-safe) */
export async function notifyUser(payload: NotificationPayload): Promise<void> {
  try {
    await prisma.appNotification.create({
      data: {
        userId: payload.userId,
        title: payload.title.slice(0, 200),
        body: payload.body.slice(0, 500),
        href: payload.href ?? null,
      },
    });
    await notificationAdapter.send(payload);
  } catch (error) {
    await writeSystemLog({
      level: "WARN",
      source: "notification",
      code: "NOTIFY_FAILED",
      message: "ส่งแจ้งเตือนไม่สำเร็จ",
      metadata: { userId: payload.userId },
      error,
    });
  }
}
