import type { Prisma, TemplateVersionStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { GAME_STEP_TYPES } from "@/lib/step-registry";
import {
  parseStepsSchema,
  validateTemplateDraft,
  type TemplateValidationResult,
} from "@/lib/validation";

export const adminTemplateQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(40).optional(),
  status: z
    .enum(["draft", "published", "deprecated", "archived", "any"])
    .optional()
    .default("any"),
  premium: z.enum(["true", "false"]).optional(),
  hasGame: z.enum(["true", "false"]).optional(),
  mood: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
  sort: z
    .enum(["recommended", "newest", "popular", "updated"])
    .default("recommended"),
});

export type AdminTemplateQuery = z.infer<typeof adminTemplateQuerySchema>;

const defaultSettings = {
  mode: "basic" as const,
  theme: { preset: "cute-pastel" as const },
  motion: {
    intensity: "normal" as const,
    reducedMotionPolicy: "honor-prefers" as const,
  },
  audio: { policy: "optional" as const },
  performance: {
    maxAssetCount: 12,
    maxTotalAssetBytes: 15 * 1024 * 1024,
  },
  runtimeRules: [] as [],
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function templateHasGame(stepsSchema: unknown): boolean {
  const steps = (stepsSchema as { steps?: { type: string }[] })?.steps ?? [];
  return steps.some((s) => GAME_STEP_TYPES.includes(s.type));
}

export async function listAdminTemplates(query: AdminTemplateQuery) {
  const where: Prisma.TemplateWhereInput = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.mood ? { mood: query.mood } : {}),
    ...(query.premium ? { isPremium: query.premium === "true" } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
            { slug: { contains: query.q, mode: "insensitive" } },
            { tags: { has: query.q } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.TemplateOrderByWithRelationInput[] =
    query.sort === "newest"
      ? [{ publishedAt: "desc" }, { createdAt: "desc" }]
      : query.sort === "popular"
        ? [{ usageCount: "desc" }, { sortOrder: "asc" }]
        : query.sort === "updated"
          ? [{ updatedAt: "desc" }]
          : [{ sortOrder: "asc" }, { usageCount: "desc" }];

  const [total, rows] = await Promise.all([
    prisma.template.count({ where }),
    prisma.template.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        currentPublishedVersion: true,
        versions: {
          orderBy: { version: "desc" },
          take: 5,
          select: {
            id: true,
            version: true,
            status: true,
            updatedAt: true,
            publishedAt: true,
          },
        },
        _count: { select: { versions: true, events: true } },
      },
    }),
  ]);

  let items = rows.map((t) => {
    const draft = t.versions.find((v) => v.status === "DRAFT");
    const published = t.currentPublishedVersion;
    const libraryStatus = draft
      ? "draft"
      : published
        ? "published"
        : t.versions[0]?.status === "DEPRECATED"
          ? "deprecated"
          : t.versions[0]?.status === "ARCHIVED"
            ? "archived"
            : "draft";
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      thumbnailUrl: t.thumbnailUrl,
      category: t.category,
      tags: t.tags,
      mood: t.mood,
      isActive: t.isActive,
      isPremium: t.isPremium,
      isFeatured: t.isFeatured,
      marketplaceVisibility: t.marketplaceVisibility,
      priceLabel: t.priceLabel,
      priceCurrency: t.priceCurrency,
      usageCount: t.usageCount,
      requiredAssetCount: t.requiredAssetCount,
      sortOrder: t.sortOrder,
      publishedAt: t.publishedAt?.toISOString() ?? null,
      updatedAt: t.updatedAt.toISOString(),
      currentPublishedVersion: published
        ? {
            id: published.id,
            version: published.version,
            status: published.status,
          }
        : null,
      draftVersion: draft
        ? { id: draft.id, version: draft.version, status: draft.status }
        : null,
      libraryStatus,
      versionCount: t._count.versions,
      eventCount: t._count.events,
      hasGame: templateHasGame(
        published?.stepsSchema ?? t.stepsSchema,
      ),
      stepCount:
        (
          (published?.stepsSchema ?? t.stepsSchema) as {
            steps?: unknown[];
          }
        )?.steps?.length ?? 0,
    };
  });

  if (query.status && query.status !== "any") {
    items = items.filter((t) => t.libraryStatus === query.status);
  }
  if (query.hasGame) {
    const want = query.hasGame === "true";
    items = items.filter((t) => t.hasGame === want);
  }

  return {
    items,
    total: query.status !== "any" || query.hasGame ? items.length : total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(
      1,
      Math.ceil(
        (query.status !== "any" || query.hasGame ? items.length : total) /
          query.limit,
      ),
    ),
  };
}

export async function getAdminTemplate(idOrSlug: string) {
  const template = await prisma.template.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      currentPublishedVersion: true,
      versions: { orderBy: { version: "desc" } },
      assets: { orderBy: { sortOrder: "asc" } },
      _count: { select: { events: true } },
    },
  });
  return template;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0e00-\u0e7f]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createTemplateDraft(params: {
  userId: string;
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  tags?: string[];
  mood?: string;
  stepsSchema?: unknown;
}) {
  const baseSlug = slugify(params.slug || params.name) || `template-${Date.now()}`;
  let slug = baseSlug;
  let i = 1;
  while (await prisma.template.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const stepsSchema = params.stepsSchema ?? {
    schemaVersion: 1,
    steps: [
      {
        key: "opening",
        type: "gift-box",
        fields: ["title_text"],
        enabled: true,
        section: "opening",
        settings: {},
        elementOverrides: {},
      },
      {
        key: "message",
        type: "text-reveal",
        fields: ["message_text", "sender_name"],
        enabled: true,
        section: "body",
        settings: {},
        elementOverrides: {},
      },
    ],
  };

  const sampleData = {
    title_text: "มีของขวัญพิเศษให้เธอ!",
    message_text: "สุขสันต์วันเกิดนะ 🎉",
    sender_name: "คนที่รักเธอ",
  };

  return prisma.$transaction(async (tx) => {
    const template = await tx.template.create({
      data: {
        slug,
        name: params.name.trim(),
        description: params.description?.trim() || "เทมเพลตใหม่จาก Template Studio",
        thumbnailUrl: "emoji:🎨",
        stepsSchema: asJson(stepsSchema),
        category: params.category ?? "birthday",
        tags: params.tags ?? [],
        mood: params.mood ?? "cute",
        isActive: false,
      },
    });

    const version = await tx.templateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        status: "DRAFT",
        schemaVersion: 1,
        stepsSchema: asJson(stepsSchema),
        dataModel: asJson({
          fields: [
            {
              key: "title_text",
              type: "short-text",
              labelTh: "หัวข้อ",
              labelEn: "Title",
              required: true,
              sampleValue: sampleData.title_text,
            },
            {
              key: "message_text",
              type: "long-text",
              labelTh: "ข้อความ",
              labelEn: "Message",
              required: true,
              sampleValue: sampleData.message_text,
            },
            {
              key: "sender_name",
              type: "short-text",
              labelTh: "จาก",
              labelEn: "From",
              required: false,
              sampleValue: sampleData.sender_name,
            },
          ],
        }),
        settings: asJson(defaultSettings),
        sampleData: asJson(sampleData),
        createdByUserId: params.userId,
      },
    });

    return { template, version };
  });
}

export async function getEditableDraft(templateId: string) {
  const draft = await prisma.templateVersion.findFirst({
    where: { templateId, status: "DRAFT" },
    orderBy: { version: "desc" },
  });
  if (draft) return draft;

  const published = await prisma.templateVersion.findFirst({
    where: { templateId, status: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  if (!published) return null;

  const maxVersion = await prisma.templateVersion.aggregate({
    where: { templateId },
    _max: { version: true },
  });

  return prisma.templateVersion.create({
    data: {
      templateId,
      version: (maxVersion._max.version ?? published.version) + 1,
      status: "DRAFT",
      schemaVersion: published.schemaVersion,
      stepsSchema: asJson(published.stepsSchema),
      dataModel: asJson(published.dataModel),
      settings: asJson(published.settings),
      sampleData: asJson(published.sampleData),
      createdByUserId: published.createdByUserId,
    },
  });
}

export async function updateDraftVersion(params: {
  templateId: string;
  userId: string;
  metadata?: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    mood?: string;
    thumbnailUrl?: string;
    requiredAssetCount?: number;
    isPremium?: boolean;
    isFeatured?: boolean;
    isActive?: boolean;
    sortOrder?: number;
    marketplaceVisibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
    priceLabel?: string | null;
    priceCurrency?: string | null;
    licensingNotes?: string | null;
  };
  draft?: {
    stepsSchema?: unknown;
    dataModel?: unknown;
    settings?: unknown;
    sampleData?: unknown;
  };
}) {
  const template = await prisma.template.findUnique({
    where: { id: params.templateId },
  });
  if (!template) return { error: "not_found" as const };

  const draft = await getEditableDraft(params.templateId);
  if (!draft || draft.status !== "DRAFT") {
    return { error: "no_draft" as const };
  }

  if (params.draft) {
    const validation = validateTemplateDraft({
      stepsSchema: params.draft.stepsSchema ?? draft.stepsSchema,
      dataModel: params.draft.dataModel ?? draft.dataModel,
      settings: params.draft.settings ?? draft.settings,
      sampleData: params.draft.sampleData ?? draft.sampleData,
      requiredAssetCount: params.metadata?.requiredAssetCount ?? template.requiredAssetCount,
    });
    if (!validation.ok) {
      return { error: "validation_failed" as const, validation };
    }
  }

  const [updatedTemplate, updatedDraft] = await prisma.$transaction([
    prisma.template.update({
      where: { id: template.id },
      data: {
        ...(params.metadata?.name !== undefined
          ? { name: params.metadata.name }
          : {}),
        ...(params.metadata?.description !== undefined
          ? { description: params.metadata.description }
          : {}),
        ...(params.metadata?.category !== undefined
          ? { category: params.metadata.category }
          : {}),
        ...(params.metadata?.tags !== undefined ? { tags: params.metadata.tags } : {}),
        ...(params.metadata?.mood !== undefined ? { mood: params.metadata.mood } : {}),
        ...(params.metadata?.thumbnailUrl !== undefined
          ? { thumbnailUrl: params.metadata.thumbnailUrl }
          : {}),
        ...(params.metadata?.requiredAssetCount !== undefined
          ? { requiredAssetCount: params.metadata.requiredAssetCount }
          : {}),
        ...(params.metadata?.isPremium !== undefined
          ? { isPremium: params.metadata.isPremium }
          : {}),
        ...(params.metadata?.isFeatured !== undefined
          ? { isFeatured: params.metadata.isFeatured }
          : {}),
        ...(params.metadata?.isActive !== undefined
          ? { isActive: params.metadata.isActive }
          : {}),
        ...(params.metadata?.sortOrder !== undefined
          ? { sortOrder: params.metadata.sortOrder }
          : {}),
        ...(params.metadata?.marketplaceVisibility !== undefined
          ? { marketplaceVisibility: params.metadata.marketplaceVisibility }
          : {}),
        ...(params.metadata?.priceLabel !== undefined
          ? { priceLabel: params.metadata.priceLabel }
          : {}),
        ...(params.metadata?.priceCurrency !== undefined
          ? { priceCurrency: params.metadata.priceCurrency }
          : {}),
        ...(params.metadata?.licensingNotes !== undefined
          ? { licensingNotes: params.metadata.licensingNotes }
          : {}),
      },
    }),
    prisma.templateVersion.update({
      where: { id: draft.id },
      data: {
        ...(params.draft?.stepsSchema !== undefined
          ? { stepsSchema: asJson(params.draft.stepsSchema) }
          : {}),
        ...(params.draft?.dataModel !== undefined
          ? { dataModel: asJson(params.draft.dataModel) }
          : {}),
        ...(params.draft?.settings !== undefined
          ? { settings: asJson(params.draft.settings) }
          : {}),
        ...(params.draft?.sampleData !== undefined
          ? { sampleData: asJson(params.draft.sampleData) }
          : {}),
        createdByUserId: params.userId,
      },
    }),
  ]);

  return { template: updatedTemplate, version: updatedDraft };
}

export async function validateTemplateVersion(
  templateId: string,
  versionId?: string,
): Promise<{ error?: "not_found"; validation?: TemplateValidationResult }> {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      assets: true,
      currentPublishedVersion: true,
    },
  });
  if (!template) return { error: "not_found" };

  const version = versionId
    ? await prisma.templateVersion.findFirst({
        where: { id: versionId, templateId },
      })
    : await getEditableDraft(templateId);

  if (!version) return { error: "not_found" };

  const assetTotalBytes = template.assets.reduce(
    (sum, a) => sum + (a.sizeBytes ?? 0),
    0,
  );

  const validation = validateTemplateDraft({
    stepsSchema: version.stepsSchema,
    dataModel: version.dataModel,
    settings: version.settings,
    sampleData: version.sampleData,
    requiredAssetCount: template.requiredAssetCount,
    assetCount: template.assets.length,
    assetTotalBytes,
    previousPublishedStepsSchema: template.currentPublishedVersion?.stepsSchema,
  });

  return { validation };
}

export async function publishTemplateVersion(params: {
  templateId: string;
  userId: string;
  releaseNotes: string;
  breakingChange?: boolean;
  migrationNotes?: string | null;
}) {
  const template = await prisma.template.findUnique({
    where: { id: params.templateId },
    include: {
      assets: true,
      currentPublishedVersion: true,
    },
  });
  if (!template) return { error: "not_found" as const };

  const draft = await prisma.templateVersion.findFirst({
    where: { templateId: params.templateId, status: "DRAFT" },
    orderBy: { version: "desc" },
  });
  if (!draft) return { error: "no_draft" as const };

  const assetTotalBytes = template.assets.reduce(
    (sum, a) => sum + (a.sizeBytes ?? 0),
    0,
  );
  const validation = validateTemplateDraft({
    stepsSchema: draft.stepsSchema,
    dataModel: draft.dataModel,
    settings: draft.settings,
    sampleData: draft.sampleData,
    requiredAssetCount: template.requiredAssetCount,
    assetCount: template.assets.length,
    assetTotalBytes,
    previousPublishedStepsSchema: template.currentPublishedVersion?.stepsSchema,
  });
  if (!validation.ok) {
    return { error: "validation_failed" as const, validation };
  }

  const notes = params.releaseNotes.trim();
  if (!notes) return { error: "release_notes_required" as const };

  const result = await prisma.$transaction(async (tx) => {
    if (template.currentPublishedVersionId) {
      await tx.templateVersion.update({
        where: { id: template.currentPublishedVersionId },
        data: { status: "DEPRECATED" },
      });
    }

    const published = await tx.templateVersion.update({
      where: { id: draft.id },
      data: {
        status: "PUBLISHED",
        releaseNotes: notes,
        breakingChange: params.breakingChange ?? false,
        migrationNotes: params.migrationNotes ?? null,
        publishedAt: new Date(),
        publishedByUserId: params.userId,
        stepsSchema: asJson(validation.stepsSchema),
        dataModel: asJson(validation.dataModel ?? draft.dataModel),
        settings: asJson(validation.settings ?? draft.settings),
      },
    });

    const updatedTemplate = await tx.template.update({
      where: { id: template.id },
      data: {
        currentPublishedVersionId: published.id,
        stepsSchema: asJson(published.stepsSchema),
        publishedAt: published.publishedAt,
        isActive: true,
      },
    });

    return { template: updatedTemplate, version: published };
  });

  return { ...result, validation };
}

export async function duplicateTemplate(params: {
  templateId: string;
  userId: string;
}) {
  const source = await getAdminTemplate(params.templateId);
  if (!source) return { error: "not_found" as const };

  const sourceVersion =
    source.versions.find((v) => v.status === "DRAFT") ??
    source.currentPublishedVersion ??
    source.versions[0];
  if (!sourceVersion) return { error: "not_found" as const };

  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let i = 1;
  while (await prisma.template.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  return prisma.$transaction(async (tx) => {
    const template = await tx.template.create({
      data: {
        slug,
        name: `${source.name} (สำเนา)`,
        description: source.description,
        thumbnailUrl: source.thumbnailUrl,
        stepsSchema: asJson(sourceVersion.stepsSchema),
        category: source.category,
        tags: source.tags,
        mood: source.mood,
        requiredAssetCount: source.requiredAssetCount,
        isPremium: source.isPremium,
        isFeatured: false,
        marketplaceVisibility: source.marketplaceVisibility,
        priceLabel: source.priceLabel,
        priceCurrency: source.priceCurrency,
        licensingNotes: source.licensingNotes,
        isActive: false,
        sortOrder: source.sortOrder,
      },
    });

    const version = await tx.templateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        status: "DRAFT",
        schemaVersion: sourceVersion.schemaVersion,
        stepsSchema: asJson(sourceVersion.stepsSchema),
        dataModel: asJson(sourceVersion.dataModel),
        settings: asJson(sourceVersion.settings),
        sampleData: asJson(sourceVersion.sampleData),
        createdByUserId: params.userId,
      },
    });

    return { template, version };
  });
}

export async function listTemplateVersions(templateId: string) {
  return prisma.templateVersion.findMany({
    where: { templateId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      releaseNotes: true,
      breakingChange: true,
      migrationNotes: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      publishedByUserId: true,
      createdByUserId: true,
    },
  });
}

export async function rollbackToVersion(params: {
  templateId: string;
  versionId: string;
  userId: string;
  releaseNotes: string;
}) {
  const historical = await prisma.templateVersion.findFirst({
    where: {
      id: params.versionId,
      templateId: params.templateId,
      status: { in: ["PUBLISHED", "DEPRECATED", "ARCHIVED"] as TemplateVersionStatus[] },
    },
  });
  if (!historical) return { error: "not_found" as const };

  const maxVersion = await prisma.templateVersion.aggregate({
    where: { templateId: params.templateId },
    _max: { version: true },
  });

  // Create draft from snapshot then publish (immutable history)
  await prisma.templateVersion.create({
    data: {
      templateId: params.templateId,
      version: (maxVersion._max.version ?? 0) + 1,
      status: "DRAFT",
      schemaVersion: historical.schemaVersion,
      stepsSchema: asJson(historical.stepsSchema),
      dataModel: asJson(historical.dataModel),
      settings: asJson(historical.settings),
      sampleData: asJson(historical.sampleData),
      createdByUserId: params.userId,
    },
  });

  return publishTemplateVersion({
    templateId: params.templateId,
    userId: params.userId,
    releaseNotes:
      params.releaseNotes.trim() ||
      `Rollback to v${historical.version}`,
    breakingChange: false,
    migrationNotes: `Cloned from version ${historical.version} (${historical.id})`,
  });
}

export async function getPublishedVersionForTemplate(templateId: string) {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { currentPublishedVersion: true },
  });
  if (!template?.currentPublishedVersion) return null;
  if (template.currentPublishedVersion.status !== "PUBLISHED") return null;
  return { template, version: template.currentPublishedVersion };
}

export function resolveEventStepsSchema(event: {
  templateVersion?: { stepsSchema: unknown } | null;
  template?: { stepsSchema: unknown } | null;
}) {
  const raw =
    event.templateVersion?.stepsSchema ?? event.template?.stepsSchema ?? null;
  if (!raw) return null;
  return parseStepsSchema(raw);
}
