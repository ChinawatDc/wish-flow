import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  sniffImageKind,
  validateUpload,
} from "./upload-validation";
import { urlToSafePath } from "./storage";

function jpegBuffer(size = 100): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

function pngBuffer(size = 100): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  return buf;
}

function webpBuffer(size = 100): Buffer {
  const buf = Buffer.alloc(size);
  buf.write("RIFF", 0, "ascii");
  buf.write("WEBP", 8, "ascii");
  return buf;
}

describe("sniffImageKind (magic bytes)", () => {
  it("ตรวจ JPEG / PNG / WebP ได้ถูกต้อง", () => {
    expect(sniffImageKind(jpegBuffer())).toBe("jpeg");
    expect(sniffImageKind(pngBuffer())).toBe("png");
    expect(sniffImageKind(webpBuffer())).toBe("webp");
  });

  it("ปฏิเสธไฟล์ที่ไม่ใช่รูป", () => {
    expect(sniffImageKind(Buffer.from("#!/bin/sh\nrm -rf /"))).toBeNull();
    expect(sniffImageKind(Buffer.from("<html></html>xxxxx"))).toBeNull();
    expect(sniffImageKind(Buffer.alloc(4))).toBeNull();
  });
});

describe("validateUpload", () => {
  it("รับไฟล์ที่ถูกต้อง", () => {
    expect(
      validateUpload({
        buffer: jpegBuffer(),
        declaredMime: "image/jpeg",
        originalName: "photo.jpg",
      }),
    ).toEqual({ ok: true, ext: "jpg", mime: "image/jpeg" });

    expect(
      validateUpload({
        buffer: pngBuffer(),
        declaredMime: "image/png",
        originalName: "pic.png",
      }),
    ).toEqual({ ok: true, ext: "png", mime: "image/png" });

    expect(
      validateUpload({
        buffer: webpBuffer(),
        declaredMime: "image/webp",
        originalName: "img.webp",
      }),
    ).toEqual({ ok: true, ext: "webp", mime: "image/webp" });
  });

  it("รับ .jpeg เป็นนามสกุลของ JPEG ด้วย", () => {
    const result = validateUpload({
      buffer: jpegBuffer(),
      declaredMime: "image/jpeg",
      originalName: "photo.jpeg",
    });
    expect(result.ok).toBe(true);
  });

  it("ปฏิเสธไฟล์ใหญ่เกิน 5 MB", () => {
    const result = validateUpload({
      buffer: jpegBuffer(MAX_UPLOAD_BYTES + 1),
      declaredMime: "image/jpeg",
      originalName: "big.jpg",
    });
    expect(result.ok).toBe(false);
  });

  it("ปฏิเสธไฟล์ว่าง", () => {
    const result = validateUpload({
      buffer: Buffer.alloc(0),
      declaredMime: "image/jpeg",
      originalName: "empty.jpg",
    });
    expect(result.ok).toBe(false);
  });

  it("ปฏิเสธ MIME ไม่ตรงกับเนื้อหาจริง (เช่น .jpg แต่เนื้อเป็น PNG)", () => {
    const result = validateUpload({
      buffer: pngBuffer(),
      declaredMime: "image/jpeg",
      originalName: "fake.jpg",
    });
    expect(result.ok).toBe(false);
  });

  it("ปฏิเสธนามสกุลอันตราย/ไม่ตรง", () => {
    for (const name of ["evil.php", "script.js", "photo.jpg.exe", "noext"]) {
      const result = validateUpload({
        buffer: jpegBuffer(),
        declaredMime: "image/jpeg",
        originalName: name,
      });
      expect(result.ok, name).toBe(false);
    }
  });

  it("ปฏิเสธไฟล์ที่ไม่ใช่รูป (magic bytes ผิด)", () => {
    const result = validateUpload({
      buffer: Buffer.from("MZ......this is an exe file"),
      declaredMime: "image/jpeg",
      originalName: "virus.jpg",
    });
    expect(result.ok).toBe(false);
  });
});

describe("urlToSafePath (กัน path traversal)", () => {
  it("รับ URL ปกติ", () => {
    const p = urlToSafePath("/api/uploads/events/abc/file.jpg");
    expect(p).not.toBeNull();
    expect(p).toContain("events");
  });

  it("ปฏิเสธ path traversal", () => {
    expect(urlToSafePath("/api/uploads/../../etc/passwd")).toBeNull();
    expect(urlToSafePath("/api/uploads/events/../../../etc/passwd")).toBeNull();
  });

  it("ปฏิเสธ URL นอก prefix", () => {
    expect(urlToSafePath("/etc/passwd")).toBeNull();
    expect(urlToSafePath("https://evil.com/x.jpg")).toBeNull();
  });
});
