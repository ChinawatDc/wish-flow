export const DEVICE_TOKEN_COOKIE = "wf_device_token";
export const UNLOCK_COOKIE_PREFIX = "wf_unlock_";

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const UNLOCK_TTL_SECONDS = 30 * 60; // 30 minutes

export function unlockCookieName(eventId: string) {
  return `${UNLOCK_COOKIE_PREFIX}${eventId}`;
}
