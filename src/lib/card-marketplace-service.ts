import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { writeAudit } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { generateSixDigitPin } from "@/lib/device-token";
import { hashPin } from "@/lib/pin";
import { sanitizeTemplateData } from "@/lib/sanitize";
import { storage } from "@/lib/storage";

async function copyAssetFile(params: {
  sourceUrl: string;
  eventId?: string;
  revisionId?: string;
}): Promise<string | null> {
  const buf = await storage.read(params.sourceUrl);
  if (!buf) return null;
  const ext = params.sourceUrl.split(".").pop()?.toLowerCase() || "bin";
  const filename = `${randomUUID()}.${ext}`;
  return storage.save({
    eventId: params.eventId,
    revisionId: params.revisionId,
    filename,
    buffer: buf,
  });
}

export async function cloneEventAssets(params: {
  sourceEventId: string;
  targetEventId: string;
}) {
  const assets = await prisma.eventAsset.findMany({
    where: { eventId: params.sourceEventId },
    orderBy: { sortOrder: "asc" },
  });

  const created: { id: string; url: string; sortOrder: number }[] = [];
  for (const asset of assets) {
    const url = await copyAssetFile({
      sourceUrl: asset.url,
      eventId: params.targetEventId,
    });
    if (!url) continue;
    const row = await prisma.eventAsset.create({
      data: {
        eventId: params.targetEventId,
        assetType: asset.assetType,
        url,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        sortOrder: asset.sortOrder,
      },
      select: { id: true, url: true, sortOrder: true },
    });
    created.push(row);
  }
  return created;
}

export async function publishCardShare(params: {
  userId: string;
  eventId: string;
  title?: string;
  blurb?: string | null;
  includeAssets: boolean;
}) {
  const event = await prisma.event.findFirst({
    where: { id: params.eventId, ownerUserId: params.userId },
    include: {
      assets: { orderBy: { sortOrder: "asc" } },
      cardListing: true,
    },
  });
  if (!event) return { error: "not_found" as const };
  if (!event.templateId || !event.templateVersionId) {
    return { error: "no_template" as const };
  }

  const title = (params.title?.trim() || event.name).slice(0, 120);
  const blurb = params.blurb?.trim()?.slice(0, 500) || null;
  const templateData = sanitizeTemplateData(
    (event.templateData ?? {}) as Record<string, unknown>,
  ) as Prisma.InputJsonValue;

  const result = await prisma.$transaction(async (tx) => {
    let listing = event.cardListing;
    if (!listing) {
      listing = await tx.cardListing.create({
        data: {
          sourceEventId: event.id,
          ownerUserId: params.userId,
          status: "LISTED",
          title,
          blurb,
          includeAssets: params.includeAssets,
          publishedAt: new Date(),
        },
      });
    } else {
      listing = await tx.cardListing.update({
        where: { id: listing.id },
        data: {
          status: "LISTED",
          title,
          blurb,
          includeAssets: params.includeAssets,
          publishedAt: new Date(),
        },
      });
    }

    const last = await tx.cardRevision.findFirst({
      where: { listingId: listing.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    const revision = await tx.cardRevision.create({
      data: {
        listingId: listing.id,
        version,
        name: event.name,
        templateId: event.templateId,
        templateVersionId: event.templateVersionId,
        templateData,
        includeAssets: params.includeAssets,
      },
    });

    await tx.cardListing.update({
      where: { id: listing.id },
      data: { currentRevisionId: revision.id },
    });

    return { listingId: listing.id, revisionId: revision.id, version };
  });

  if (params.includeAssets && event.assets.length > 0) {
    for (const asset of event.assets) {
      const url = await copyAssetFile({
        sourceUrl: asset.url,
        revisionId: result.revisionId,
      });
      if (!url) continue;
      await prisma.cardRevisionAsset.create({
        data: {
          revisionId: result.revisionId,
          assetType: asset.assetType,
          url,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          sortOrder: asset.sortOrder,
        },
      });
    }
  }

  await writeAudit({
    action: AUDIT_ACTIONS.CARD_SHARE_PUBLISH,
    actor: { userId: params.userId },
    resourceType: "card_listing",
    resourceId: result.listingId,
    summaryTh: `เผยแพร่การ์ดแชร์ รุ่น ${result.version}`,
    metadata: {
      eventId: event.id,
      version: result.version,
      includeAssets: params.includeAssets,
    },
  });

  return { ok: true as const, ...result };
}

export async function unpublishCardShare(params: {
  userId: string;
  eventId: string;
}) {
  const listing = await prisma.cardListing.findFirst({
    where: { sourceEventId: params.eventId, ownerUserId: params.userId },
  });
  if (!listing) return { error: "not_found" as const };

  await prisma.cardListing.update({
    where: { id: listing.id },
    data: { status: "UNLISTED" },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.CARD_SHARE_UNPUBLISH,
    actor: { userId: params.userId },
    resourceType: "card_listing",
    resourceId: listing.id,
    summaryTh: "เลิกเผยแพร่การ์ดแชร์",
    metadata: { eventId: params.eventId },
  });

  return { ok: true as const, listingId: listing.id };
}

export async function listCardRevisions(params: {
  userId: string;
  eventId: string;
}) {
  const listing = await prisma.cardListing.findFirst({
    where: { sourceEventId: params.eventId, ownerUserId: params.userId },
    include: {
      revisions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          name: true,
          includeAssets: true,
          createdAt: true,
        },
      },
    },
  });
  if (!listing) return { error: "not_found" as const };
  return {
    listing: {
      id: listing.id,
      status: listing.status,
      title: listing.title,
      heartCount: listing.heartCount,
      useCount: listing.useCount,
      currentRevisionId: listing.currentRevisionId,
    },
    revisions: listing.revisions.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      isCurrent: r.id === listing.currentRevisionId,
    })),
  };
}

export async function listMarketplaceCards(params: {
  userId: string;
  q?: string;
  page: number;
  limit: number;
}) {
  const where = {
    status: "LISTED" as const,
    currentRevisionId: { not: null },
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" as const } },
            { blurb: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.cardListing.count({ where }),
    prisma.cardListing.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        owner: { select: { id: true, name: true, username: true } },
        currentRevision: {
          include: {
            assets: {
              orderBy: { sortOrder: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
        hearts: {
          where: { userId: params.userId },
          select: { userId: true },
        },
      },
    }),
  ]);

  return {
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
    cards: rows.map((row) => ({
      id: row.id,
      title: row.title,
      blurb: row.blurb,
      includeAssets: row.includeAssets,
      heartCount: row.heartCount,
      useCount: row.useCount,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      owner: {
        name: row.owner.name || row.owner.username || "ผู้ใช้",
      },
      previewUrl: row.currentRevision?.assets[0]?.url ?? null,
      version: row.currentRevision?.version ?? null,
      heartedByMe: row.hearts.length > 0,
      isOwn: row.ownerUserId === params.userId,
    })),
  };
}

export async function getMarketplaceCard(params: {
  userId: string;
  listingId: string;
}) {
  const listing = await prisma.cardListing.findFirst({
    where: {
      id: params.listingId,
      OR: [{ status: "LISTED" }, { ownerUserId: params.userId }],
    },
    include: {
      owner: { select: { id: true, name: true, username: true } },
      currentRevision: {
        include: {
          assets: { orderBy: { sortOrder: "asc" } },
        },
      },
      hearts: {
        where: { userId: params.userId },
        select: { userId: true },
      },
    },
  });
  if (!listing || !listing.currentRevision) return { error: "not_found" as const };

  const rev = listing.currentRevision;
  const [template, templateVersion] = await Promise.all([
    rev.templateId
      ? prisma.template.findUnique({
          where: { id: rev.templateId },
          select: { id: true, slug: true, name: true },
        })
      : null,
    rev.templateVersionId
      ? prisma.templateVersion.findUnique({
          where: { id: rev.templateVersionId },
          select: { id: true, version: true, stepsSchema: true, settings: true },
        })
      : null,
  ]);

  return {
    card: {
      id: listing.id,
      title: listing.title,
      blurb: listing.blurb,
      includeAssets: listing.includeAssets,
      heartCount: listing.heartCount,
      useCount: listing.useCount,
      publishedAt: listing.publishedAt?.toISOString() ?? null,
      status: listing.status,
      owner: {
        name: listing.owner.name || listing.owner.username || "ผู้ใช้",
      },
      heartedByMe: listing.hearts.length > 0,
      isOwn: listing.ownerUserId === params.userId,
      revision: {
        id: rev.id,
        version: rev.version,
        name: rev.name,
        templateData: sanitizeTemplateData(
          (rev.templateData ?? {}) as Record<string, unknown>,
        ),
        assets: rev.includeAssets
          ? rev.assets.map((a) => ({
              id: a.id,
              url: a.url,
              sortOrder: a.sortOrder,
            }))
          : [],
        template,
        stepsSchema: templateVersion?.stepsSchema ?? null,
        settings: templateVersion?.settings ?? {},
      },
    },
  };
}

export async function toggleCardHeart(params: {
  userId: string;
  listingId: string;
}) {
  const listing = await prisma.cardListing.findFirst({
    where: { id: params.listingId, status: "LISTED" },
  });
  if (!listing) return { error: "not_found" as const };

  const existing = await prisma.cardHeart.findUnique({
    where: {
      listingId_userId: {
        listingId: params.listingId,
        userId: params.userId,
      },
    },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.cardHeart.delete({
        where: {
          listingId_userId: {
            listingId: params.listingId,
            userId: params.userId,
          },
        },
      }),
      prisma.cardListing.update({
        where: { id: params.listingId },
        data: { heartCount: { decrement: 1 } },
      }),
    ]);
    const updated = await prisma.cardListing.findUniqueOrThrow({
      where: { id: params.listingId },
      select: { heartCount: true },
    });
    return {
      hearted: false,
      heartCount: Math.max(0, updated.heartCount),
    };
  }

  await prisma.$transaction([
    prisma.cardHeart.create({
      data: { listingId: params.listingId, userId: params.userId },
    }),
    prisma.cardListing.update({
      where: { id: params.listingId },
      data: { heartCount: { increment: 1 } },
    }),
  ]);
  const updated = await prisma.cardListing.findUniqueOrThrow({
    where: { id: params.listingId },
    select: { heartCount: true },
  });
  return { hearted: true, heartCount: updated.heartCount };
}

export async function forkMarketplaceCard(params: {
  userId: string;
  listingId: string;
}) {
  const listing = await prisma.cardListing.findFirst({
    where: { id: params.listingId, status: "LISTED" },
    include: {
      currentRevision: {
        include: { assets: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!listing || !listing.currentRevision) {
    return { error: "not_found" as const };
  }
  if (listing.ownerUserId === params.userId) {
    return { error: "cannot_use_own" as const };
  }

  const rev = listing.currentRevision;
  const pin = generateSixDigitPin();
  const pinHash = await hashPin(pin);
  const templateData = sanitizeTemplateData(
    (rev.templateData ?? {}) as Record<string, unknown>,
  ) as Prisma.InputJsonValue;

  const existingUse = await prisma.cardUse.findUnique({
    where: {
      listingId_userId: {
        listingId: listing.id,
        userId: params.userId,
      },
    },
  });

  const forked = await prisma.event.create({
    data: {
      name: `${rev.name} (จากคลัง)`,
      ownerUserId: params.userId,
      claimedAt: new Date(),
      templateId: rev.templateId,
      templateVersionId: rev.templateVersionId,
      templateData,
      pinHash,
      status: "draft",
      forkedFromListingId: listing.id,
      forkedFromRevisionId: rev.id,
    },
  });

  if (rev.includeAssets && rev.assets.length > 0) {
    for (const asset of rev.assets) {
      const url = await copyAssetFile({
        sourceUrl: asset.url,
        eventId: forked.id,
      });
      if (!url) continue;
      await prisma.eventAsset.create({
        data: {
          eventId: forked.id,
          assetType: asset.assetType,
          url,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          sortOrder: asset.sortOrder,
        },
      });
    }
  }

  if (!existingUse) {
    await prisma.$transaction([
      prisma.cardUse.create({
        data: {
          listingId: listing.id,
          userId: params.userId,
          revisionId: rev.id,
          forkedEventId: forked.id,
        },
      }),
      prisma.cardListing.update({
        where: { id: listing.id },
        data: { useCount: { increment: 1 } },
      }),
    ]);
  }

  await writeAudit({
    action: AUDIT_ACTIONS.CARD_MARKETPLACE_USE,
    actor: { userId: params.userId },
    resourceType: "card_listing",
    resourceId: listing.id,
    summaryTh: "นำไปใช้การ์ดจากคลังแชร์",
    metadata: {
      forkedEventId: forked.id,
      revisionId: rev.id,
      unique: !existingUse,
    },
  });

  return {
    ok: true as const,
    eventId: forked.id,
    pin,
    uniqueUse: !existingUse,
  };
}
