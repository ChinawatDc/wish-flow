export const DEVICE_TOKEN_COOKIE = "wf_device_token";
export const UNLOCK_COOKIE_PREFIX = "wf_unlock_";

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const UNLOCK_TTL_SECONDS = 30 * 60; // 30 minutes

export function unlockCookieName(eventId: string) {
  return `${UNLOCK_COOKIE_PREFIX}${eventId}`;
}

// ---- G7: Account security (Security PIN ของบัญชี — คนละอย่างกับ Event PIN) ----
export const STEP_UP_COOKIE = "wf_admin_step_up";
export const STEP_UP_TTL_SECONDS = 5 * 60; // 5 minutes
export const SECURITY_PIN_LENGTH = 6;
export const SECURITY_PIN_MAX_ATTEMPTS = 5;
export const SECURITY_PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ---- G7: Support ----
export const SUPPORT_DEVICE_COOKIE = "wf_support_device";
export const SUPPORT_CONTACT_RATE_LIMIT = 5; // cases per window per ip/device
export const SUPPORT_CONTACT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const SUPPORT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_POLL_INTERVAL_MS = 4000;

// ---- G7: Log retention (days) ----
export const AUDIT_LOG_RETENTION_DAYS = 365;
export const SYSTEM_LOG_ERROR_RETENTION_DAYS = 180;
export const SYSTEM_LOG_INFO_RETENTION_DAYS = 30;
export const SUPPORT_PRIVACY_RETENTION_DAYS = 30; // ล้าง ipHash/userAgentDigest หลังปิดเคส

// ---- G9: Guestbook ----
export const GUESTBOOK_DEVICE_COOKIE = "wf_guestbook_device";
export const GUESTBOOK_RATE_LIMIT = 5;
export const GUESTBOOK_RATE_WINDOW_MS = 60 * 60 * 1000;
export const GUESTBOOK_MESSAGE_MAX_LENGTH = 1000;
export const GUESTBOOK_NAME_MAX_LENGTH = 80;
export const GUESTBOOK_BULK_MAX = 50;
export const GUESTBOOK_WALL_LIMIT_MAX = 24;
export const GUESTBOOK_POLL_INTERVAL_MS = 8000;