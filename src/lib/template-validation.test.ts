import { describe, expect, it } from "vitest";

import { validateTemplateDraft } from "@/lib/validation";

describe("validateTemplateDraft", () => {
  it("ผ่าน schema พื้นฐานที่มี sample data", () => {
    const result = validateTemplateDraft({
      stepsSchema: {
        schemaVersion: 1,
        steps: [
          {
            key: "opening",
            type: "gift-box",
            fields: ["title_text"],
            enabled: true,
            section: "opening",
          },
        ],
      },
      dataModel: {
        fields: [
          {
            key: "title_text",
            type: "short-text",
            labelTh: "หัวข้อ",
            labelEn: "Title",
            required: true,
            sampleValue: "สวัสดี",
          },
        ],
      },
      sampleData: { title_text: "สวัสดี" },
      settings: {},
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("ปฏิเสธ step type ที่ไม่อยู่ใน registry", () => {
    const result = validateTemplateDraft({
      stepsSchema: {
        schemaVersion: 1,
        steps: [{ key: "x", type: "hack-script", fields: [] }],
      },
      sampleData: {},
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "unknown_step_type")).toBe(true);
  });

  it("ปฏิเสธ reserved field key", () => {
    const result = validateTemplateDraft({
      stepsSchema: {
        schemaVersion: 1,
        steps: [{ key: "a", type: "gift-box", fields: ["title_text"] }],
      },
      dataModel: {
        fields: [
          {
            key: "pin",
            type: "short-text",
            labelTh: "PIN",
            labelEn: "PIN",
            required: false,
            sampleValue: "x",
          },
        ],
      },
      sampleData: { title_text: "hi", pin: "x" },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "reserved_field_key")).toBe(true);
  });

  it("บังคับ sample data สำหรับ field ที่ต้องใช้", () => {
    const result = validateTemplateDraft({
      stepsSchema: {
        schemaVersion: 1,
        steps: [{ key: "a", type: "gift-box", fields: ["title_text"] }],
      },
      sampleData: {},
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_sample_data")).toBe(true);
  });
});
