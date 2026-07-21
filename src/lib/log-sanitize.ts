/**
 * ตัด key อันตรายออกจาก metadata ก่อนเขียนลง audit/system log
 * ห้ามมี password / pin / token / secret / authorization / cookie หลุดลง DB
 */

const BLOCKED_KEY_PATTERN =
  /(password|passwd|pwd|pin|token|secret|authorization|auth[-_]?header|cookie|credential|api[-_]?key)/i;

const MAX_DEPTH = 6;
const MAX_STRING_LENGTH = 500;

export function sanitizeMetadata(
  input: unknown,
  depth = 0,
): Record<string, unknown> {
  if (depth > MAX_DEPTH || input == null || typeof input !== "object") {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (BLOCKED_KEY_PATTERN.test(key)) continue;
    out[key] = sanitizeValue(value, depth + 1);
  }
  return out;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (depth > MAX_DEPTH) return [];
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") return sanitizeMetadata(value, depth);
  return String(value);
}
