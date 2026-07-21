const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - 543;
}

/** "2026-07-21" → "21-07-2569" */
export function isoToThaiDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}-${mo}-${toBuddhistYear(Number(y))}`;
}

/** "21-07-2569" → "2026-07-21" (null ถ้า format ผิด) */
export function thaiDisplayToIso(display: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const [, d, mo, by] = m;
  const year = toGregorianYear(Number(by));
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** Date → "2026-07-21" (local date, no timezone shift) */
export function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-07-21" → Date (local midnight) */
export function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function thaiMonthName(monthIndex: number, short = false): string {
  return (short ? THAI_MONTHS_SHORT : THAI_MONTHS)[monthIndex] ?? "";
}

/** Date → "21 กรกฎาคม 2569" */
export function dateToThaiLong(date: Date): string {
  return `${date.getDate()} ${thaiMonthName(date.getMonth())} ${toBuddhistYear(date.getFullYear())}`;
}
