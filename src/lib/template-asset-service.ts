import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import {
  MAX_ASSETS_PER_EVENT,
  validateUpload,
} from "@/lib/upload-validation";

export async function listTemplateAssets(templateId: string) {
  return prisma.templateAsset.findMany({
    where: { templateId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function uploadTemplateAsset(params: {
  templateId: string;
  buffer: Buffer;
  declaredMime: string;
  originalName: string;
}) {
  const template = await prisma.template.findUnique({
    where: { id: params.templateId },
  });
  if (!template) return { ok: false as const, status: 404 as const, reason: "ไม่พบเทมเพลต" };

  const count = await prisma.templateAsset.count({
    where: { templateId: params.templateId },
  });
  if (count >= MAX_ASSETS_PER_EVENT) {
    return {
      ok: false as const,
      status: 409 as const,
      reason: `แนบรูปได้สูงสุด ${MAX_ASSETS_PER_EVENT} รูปต่อเทมเพลต`,
    };
  }

  const validation = validateUpload({
    buffer: params.buffer,
    declaredMime: params.declaredMime,
    originalName: params.originalName,
  });
  if (!validation.ok) {
    return { ok: false as const, status: 400 as const, reason: validation.reason };
  }

  const filename = `${randomUUID()}.${validation.ext}`;
  const url = await storage.save({
    templateId: params.templateId,
    filename,
    buffer: params.buffer,
  });

  const asset = await prisma.templateAsset.create({
    data: {
      templateId: params.templateId,
      assetType: "image",
      url,
      mimeType: validation.mime,
      sizeBytes: params.buffer.length,
      sortOrder: count,
    },
  });

  return { ok: true as const, asset };
}

export async function deleteTemplateAsset(params: {
  templateId: string;
  assetId: string;
}) {
  const asset = await prisma.templateAsset.findFirst({
    where: { id: params.assetId, templateId: params.templateId },
  });
  if (!asset) return { ok: false as const, status: 404 as const };

  await storage.delete(asset.url);
  await prisma.templateAsset.delete({ where: { id: asset.id } });
  return { ok: true as const };
}
