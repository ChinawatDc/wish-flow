export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ASSETS_PER_EVENT = 12;

const ALLOWED: Record<string, { ext: string; mimes: string[] }> = {
  jpeg: { ext: "jpg", mimes: ["image/jpeg"] },
  png: { ext: "png", mimes: ["image/png"] },
  webp: { ext: "webp", mimes: ["image/webp"] },
};

export type UploadValidation =
  | { ok: true; ext: string; mime: string }
  | { ok: false; reason: string };

/** ตรวจ magic bytes ให้ตรงชนิดไฟล์จริง ไม่เชื่อ MIME/นามสกุลอย่างเดียว */
export function sniffImageKind(buffer: Buffer): keyof typeof ALLOWED | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function validateUpload(params: {
  buffer: Buffer;
  declaredMime: string;
  originalName: string;
}): UploadValidation {
  const { buffer, declaredMime, originalName } = params;

  if (buffer.length === 0) return { ok: false, reason: "ไฟล์ว่างเปล่า" };
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "ไฟล์ใหญ่เกิน 5 MB" };
  }

  const kind = sniffImageKind(buffer);
  if (!kind) {
    return { ok: false, reason: "รองรับเฉพาะรูป JPG, PNG, WebP" };
  }

  const spec = ALLOWED[kind];
  if (!spec.mimes.includes(declaredMime)) {
    return { ok: false, reason: "ชนิดไฟล์ไม่ตรงกับเนื้อหา" };
  }

  const extMatch = /\.([a-z0-9]+)$/i.exec(originalName);
  const declaredExt = extMatch?.[1]?.toLowerCase() ?? "";
  const validExts = kind === "jpeg" ? ["jpg", "jpeg"] : [spec.ext];
  if (!validExts.includes(declaredExt)) {
    return { ok: false, reason: "นามสกุลไฟล์ไม่ถูกต้อง" };
  }

  return { ok: true, ext: spec.ext, mime: spec.mimes[0] };
}
