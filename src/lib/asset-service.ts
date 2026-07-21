import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import {
  MAX_ASSETS_PER_EVENT,
  validateUpload,
} from "@/lib/upload-validation";

async function findOwnedEvent(userId: string, eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, ownerUserId: userId },
  });
}

export async function listAssets(eventId: string) {
  return prisma.eventAsset.findMany({
    where: { eventId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, url: true, assetType: true, sortOrder: true },
  });
}

export type UploadAssetResult =
  | { ok: true; asset: { id: string; url: string; sortOrder: number } }
  | { ok: false; status: 401 | 404 | 400 | 409; reason: string };

export async function uploadAsset(params: {
  userId: string;
  eventId: string;
  buffer: Buffer;
  declaredMime: string;
  originalName: string;
}): Promise<UploadAssetResult> {
  const event = await findOwnedEvent(params.userId, params.eventId);
  if (!event) return { ok: false, status: 404, reason: "ไม่พบอีเวนต์นี้" };

  const count = await prisma.eventAsset.count({ where: { eventId: event.id } });
  if (count >= MAX_ASSETS_PER_EVENT) {
    return {
      ok: false,
      status: 409,
      reason: `แนบรูปได้สูงสุด ${MAX_ASSETS_PER_EVENT} รูปต่อการ์ด`,
    };
  }

  const validation = validateUpload({
    buffer: params.buffer,
    declaredMime: params.declaredMime,
    originalName: params.originalName,
  });
  if (!validation.ok) {
    return { ok: false, status: 400, reason: validation.reason };
  }

  const filename = `${randomUUID()}.${validation.ext}`;
  const url = await storage.save({
    eventId: event.id,
    filename,
    buffer: params.buffer,
  });

  const asset = await prisma.eventAsset.create({
    data: {
      eventId: event.id,
      assetType: "image",
      url,
      mimeType: validation.mime,
      sizeBytes: params.buffer.length,
      sortOrder: count,
    },
    select: { id: true, url: true, sortOrder: true },
  });

  return { ok: true, asset };
}

export async function deleteAsset(params: {
  userId: string;
  eventId: string;
  assetId: string;
}): Promise<{ ok: true } | { ok: false; status: 404; reason: string }> {
  const event = await findOwnedEvent(params.userId, params.eventId);
  if (!event) return { ok: false, status: 404, reason: "ไม่พบอีเวนต์นี้" };

  const asset = await prisma.eventAsset.findFirst({
    where: { id: params.assetId, eventId: event.id },
  });
  if (!asset) return { ok: false, status: 404, reason: "ไม่พบรูปนี้" };

  await storage.delete(asset.url);
  await prisma.eventAsset.delete({ where: { id: asset.id } });

  const rest = await prisma.eventAsset.findMany({
    where: { eventId: event.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  await Promise.all(
    rest.map((a, i) =>
      prisma.eventAsset.update({ where: { id: a.id }, data: { sortOrder: i } }),
    ),
  );

  return { ok: true };
}

export async function reorderAssets(params: {
  userId: string;
  eventId: string;
  orderedIds: string[];
}): Promise<{ ok: true } | { ok: false; status: 404 | 400; reason: string }> {
  const event = await findOwnedEvent(params.userId, params.eventId);
  if (!event) return { ok: false, status: 404, reason: "ไม่พบอีเวนต์นี้" };

  const assets = await prisma.eventAsset.findMany({
    where: { eventId: event.id },
    select: { id: true },
  });
  const existing = new Set(assets.map((a) => a.id));
  if (
    params.orderedIds.length !== assets.length ||
    !params.orderedIds.every((id) => existing.has(id))
  ) {
    return { ok: false, status: 400, reason: "ลำดับรูปไม่ถูกต้อง" };
  }

  await Promise.all(
    params.orderedIds.map((id, i) =>
      prisma.eventAsset.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
  return { ok: true };
}

export async function deleteAllAssetFiles(eventId: string) {
  const assets = await prisma.eventAsset.findMany({
    where: { eventId },
    select: { url: true },
  });
  await Promise.all(assets.map((a) => storage.delete(a.url)));
}
