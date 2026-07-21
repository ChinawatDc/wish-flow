import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { jsonOk } from "@/lib/http";
import { getOrCreateConversation } from "@/lib/support-chat-service";

/** User — get-or-create conversation ของตัวเอง (1 user = 1 conversation) */
export async function GET() {
  try {
    const user = await requireUser();
    const conversation = await getOrCreateConversation(user);
    return jsonOk({
      conversation: {
        id: conversation.id,
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        userUnreadCount: conversation.userUnreadCount,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST() {
  return GET();
}
