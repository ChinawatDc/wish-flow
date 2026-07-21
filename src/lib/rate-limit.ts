import { PIN_MAX_ATTEMPTS, PIN_WINDOW_MS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export type RateLimitResult =
  | { limited: false; remaining: number }
  | { limited: true; retryAfterSeconds: number };

/** Rate-limit failed PIN attempts per IP + event using event_access_logs. */
export async function checkPinRateLimit(
  eventId: string,
  ipAddress: string | null,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - PIN_WINDOW_MS);

  const failures = await prisma.eventAccessLog.findMany({
    where: {
      eventId,
      success: false,
      attemptedAt: { gte: since },
      ...(ipAddress ? { ipAddress } : {}),
    },
    orderBy: { attemptedAt: "asc" },
    select: { attemptedAt: true },
  });

  if (failures.length < PIN_MAX_ATTEMPTS) {
    return { limited: false, remaining: PIN_MAX_ATTEMPTS - failures.length };
  }

  const oldest = failures[0]?.attemptedAt ?? since;
  const retryAfterMs = oldest.getTime() + PIN_WINDOW_MS - Date.now();
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

export async function logPinAttempt(params: {
  eventId: string;
  ipAddress: string | null;
  success: boolean;
}) {
  await prisma.eventAccessLog.create({
    data: {
      eventId: params.eventId,
      ipAddress: params.ipAddress,
      success: params.success,
    },
  });
}
