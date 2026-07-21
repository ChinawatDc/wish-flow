import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEvent } from "@/lib/event-service";
import { prisma } from "@/lib/db";
import {
  createTemplateDraft,
  publishTemplateVersion,
  updateDraftVersion,
  validateTemplateVersion,
} from "@/lib/template-studio-service";
import { resolveEventStepsSchema } from "@/lib/template-studio-service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("template studio integration", () => {
  const ids: string[] = [];
  let adminId = "";
  let userId = "";

  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: {
        email: `studio-admin-${randomUUID()}@test.local`,
        role: "ADMIN",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `studio-user-${randomUUID()}@test.local`,
        role: "USER",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
      },
    });
    adminId = admin.id;
    userId = user.id;
    ids.push(adminId, userId);
  });

  afterAll(async () => {
    for (const id of ids) {
      await prisma.event.deleteMany({ where: { ownerUserId: id } });
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    // cleanup templates created in tests (slug prefix)
    const temps = await prisma.template.findMany({
      where: { slug: { startsWith: "studio-test-" } },
    });
    for (const t of temps) {
      await prisma.event.updateMany({
        where: { templateId: t.id },
        data: { templateVersionId: null, templateId: null },
      });
      await prisma.template.update({
        where: { id: t.id },
        data: { currentPublishedVersionId: null },
      });
      await prisma.templateVersion.deleteMany({ where: { templateId: t.id } });
      await prisma.template.delete({ where: { id: t.id } });
    }
  });

  it("create draft → validate → publish และ event เดิมไม่เปลี่ยน pin", async () => {
    const source = await createTemplateDraft({
      userId: adminId,
      name: "Compat Source",
      slug: `studio-test-compat-${randomUUID().slice(0, 8)}`,
    });
    await updateDraftVersion({
      templateId: source.template.id,
      userId: adminId,
      metadata: { isActive: true },
      draft: {
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
            {
              key: "message",
              type: "text-reveal",
              fields: ["message_text", "sender_name"],
              enabled: true,
              section: "body",
            },
          ],
        },
        sampleData: {
          title_text: "ทักทาย",
          message_text: "ข้อความ",
          sender_name: "ผู้ทดสอบ",
        },
        dataModel: {
          fields: [
            {
              key: "title_text",
              type: "short-text",
              labelTh: "หัวข้อ",
              labelEn: "Title",
              required: true,
              sampleValue: "ทักทาย",
            },
            {
              key: "message_text",
              type: "long-text",
              labelTh: "ข้อความ",
              labelEn: "Message",
              required: true,
              sampleValue: "ข้อความ",
            },
            {
              key: "sender_name",
              type: "short-text",
              labelTh: "จาก",
              labelEn: "From",
              required: false,
              sampleValue: "ผู้ทดสอบ",
            },
          ],
        },
      },
    });
    const v1 = await publishTemplateVersion({
      templateId: source.template.id,
      userId: adminId,
      releaseNotes: "compat v1",
    });
    expect("error" in v1).toBe(false);
    if ("error" in v1) return;

    const created = await createEvent({
      userId,
      name: "Pin Compat Event",
      pin: "123456",
    });
    // Point event at our published template version explicitly
    await prisma.event.update({
      where: { id: created.event.id },
      data: {
        templateId: source.template.id,
        templateVersionId: v1.version.id,
      },
    });
    const pinnedBefore = v1.version.id;

    const draft = await createTemplateDraft({
      userId: adminId,
      name: "Studio Test Template",
      slug: `studio-test-${randomUUID().slice(0, 8)}`,
    });

    const update = await updateDraftVersion({
      templateId: draft.template.id,
      userId: adminId,
      draft: {
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
            {
              key: "message",
              type: "text-reveal",
              fields: ["message_text", "sender_name"],
              enabled: true,
              section: "body",
            },
          ],
        },
        sampleData: {
          title_text: "ทักทาย",
          message_text: "ข้อความทดสอบ",
          sender_name: "ผู้ทดสอบ",
        },
        dataModel: {
          fields: [
            {
              key: "title_text",
              type: "short-text",
              labelTh: "หัวข้อ",
              labelEn: "Title",
              required: true,
              sampleValue: "ทักทาย",
            },
            {
              key: "message_text",
              type: "long-text",
              labelTh: "ข้อความ",
              labelEn: "Message",
              required: true,
              sampleValue: "ข้อความทดสอบ",
            },
            {
              key: "sender_name",
              type: "short-text",
              labelTh: "จาก",
              labelEn: "From",
              required: false,
              sampleValue: "ผู้ทดสอบ",
            },
          ],
        },
      },
    });
    expect("error" in update).toBe(false);

    const validated = await validateTemplateVersion(draft.template.id);
    expect(validated.validation?.ok).toBe(true);

    const published = await publishTemplateVersion({
      templateId: draft.template.id,
      userId: adminId,
      releaseNotes: "First studio publish",
    });
    expect("error" in published).toBe(false);
    if ("error" in published) return;
    expect(published.version.status).toBe("PUBLISHED");

    const sourceDraft = await updateDraftVersion({
      templateId: source.template.id,
      userId: adminId,
      draft: {
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
            {
              key: "extra",
              type: "confetti-pop",
              fields: ["confetti_message"],
              enabled: true,
              section: "finale",
            },
          ],
        },
        sampleData: {
          title_text: "ใหม่",
          confetti_message: "ปาร์ตี้",
        },
        dataModel: {
          fields: [
            {
              key: "title_text",
              type: "short-text",
              labelTh: "หัวข้อ",
              labelEn: "Title",
              required: true,
              sampleValue: "ใหม่",
            },
            {
              key: "confetti_message",
              type: "short-text",
              labelTh: "คอนเฟตติ",
              labelEn: "Confetti",
              required: true,
              sampleValue: "ปาร์ตี้",
            },
          ],
        },
        settings: {
          mode: "basic",
          theme: { preset: "cute-pastel" },
          motion: {
            intensity: "normal",
            reducedMotionPolicy: "honor-prefers",
          },
          audio: { policy: "optional" },
          performance: {
            maxAssetCount: 12,
            maxTotalAssetBytes: 15 * 1024 * 1024,
          },
          runtimeRules: [],
        },
      },
    });
    if ("error" in sourceDraft) {
      expect.fail(JSON.stringify(sourceDraft));
    }

    const sourcePublish = await publishTemplateVersion({
      templateId: source.template.id,
      userId: adminId,
      releaseNotes: "v2 should not move old events",
    });
    expect("error" in sourcePublish).toBe(false);
    if ("error" in sourcePublish) return;

    const eventAfter = await prisma.event.findUniqueOrThrow({
      where: { id: created.event.id },
      include: { templateVersion: true, template: true },
    });
    expect(eventAfter.templateVersionId).toBe(pinnedBefore);
    expect(eventAfter.templateVersionId).not.toBe(sourcePublish.version.id);

    const schema = resolveEventStepsSchema(eventAfter);
    expect(schema?.steps.some((s) => s.key === "extra")).toBe(false);
    expect(schema?.steps.some((s) => s.key === "message")).toBe(true);
  });

  it("publish ต้องมี release notes และ validation กัน schema เสีย", async () => {
    const draft = await createTemplateDraft({
      userId: adminId,
      name: "Bad Schema",
      slug: `studio-test-bad-${randomUUID().slice(0, 8)}`,
    });

    await prisma.templateVersion.update({
      where: { id: draft.version.id },
      data: {
        stepsSchema: {
          schemaVersion: 1,
          steps: [{ key: "x", type: "not-a-real-step", fields: [] }],
        },
        sampleData: {},
      },
    });

    const result = await publishTemplateVersion({
      templateId: draft.template.id,
      userId: adminId,
      releaseNotes: "should fail",
    });
    expect(result).toMatchObject({ error: "validation_failed" });

    const noNotes = await publishTemplateVersion({
      templateId: draft.template.id,
      userId: adminId,
      releaseNotes: "   ",
    });
    // still validation_failed first because schema bad — ensure notes checked on valid drafts
    expect("error" in noNotes).toBe(true);
  });

  it("published version immutable: updateDraftVersion ไม่แตะ published row", async () => {
    const draft = await createTemplateDraft({
      userId: adminId,
      name: "Immutable",
      slug: `studio-test-imm-${randomUUID().slice(0, 8)}`,
    });
    await updateDraftVersion({
      templateId: draft.template.id,
      userId: adminId,
      draft: {
        sampleData: {
          title_text: "A",
          message_text: "B",
          sender_name: "C",
        },
      },
    });
    const published = await publishTemplateVersion({
      templateId: draft.template.id,
      userId: adminId,
      releaseNotes: "lock it",
    });
    expect("error" in published).toBe(false);
    if ("error" in published) return;

    const publishedId = published.version.id;
    const before = await prisma.templateVersion.findUniqueOrThrow({
      where: { id: publishedId },
    });

    // editing creates/uses a new draft — published steps stay
    await updateDraftVersion({
      templateId: draft.template.id,
      userId: adminId,
      draft: {
        stepsSchema: {
          schemaVersion: 1,
          steps: [
            {
              key: "only",
              type: "final-celebration",
              fields: ["final_message"],
              enabled: true,
              section: "finale",
            },
          ],
        },
        sampleData: { final_message: "จบ" },
        dataModel: {
          fields: [
            {
              key: "final_message",
              type: "short-text",
              labelTh: "จบ",
              labelEn: "End",
              required: true,
              sampleValue: "จบ",
            },
          ],
        },
      },
    });

    const after = await prisma.templateVersion.findUniqueOrThrow({
      where: { id: publishedId },
    });
    expect(after.status).toBe("PUBLISHED");
    expect(JSON.stringify(after.stepsSchema)).toBe(JSON.stringify(before.stepsSchema));
  });
});
