/** Escape HTML entities to mitigate XSS in guest-facing text. */
export function sanitizeText(input: unknown): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeTemplateData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      out[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "string" ? sanitizeText(item) : item,
      );
    } else if (value && typeof value === "object") {
      out[key] = sanitizeTemplateData(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
