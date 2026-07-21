-- CreateEnum
CREATE TYPE "CardListingStatus" AS ENUM ('LISTED', 'UNLISTED');

-- AlterTable events: lineage
ALTER TABLE "events" ADD COLUMN "duplicated_from_event_id" UUID,
ADD COLUMN "forked_from_listing_id" UUID,
ADD COLUMN "forked_from_revision_id" UUID;

-- CreateTable
CREATE TABLE "card_listings" (
    "id" UUID NOT NULL,
    "source_event_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "status" "CardListingStatus" NOT NULL DEFAULT 'LISTED',
    "title" TEXT NOT NULL,
    "blurb" TEXT,
    "include_assets" BOOLEAN NOT NULL DEFAULT false,
    "current_revision_id" UUID,
    "heart_count" INTEGER NOT NULL DEFAULT 0,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "card_revisions" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "template_id" UUID,
    "template_version_id" UUID,
    "template_data" JSONB NOT NULL DEFAULT '{}',
    "include_assets" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "card_revision_assets" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "asset_type" TEXT,
    "url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_revision_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "card_hearts" (
    "listing_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_hearts_pkey" PRIMARY KEY ("listing_id","user_id")
);

CREATE TABLE "card_uses" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "forked_event_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_uses_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques
CREATE UNIQUE INDEX "card_listings_source_event_id_key" ON "card_listings"("source_event_id");
CREATE UNIQUE INDEX "card_listings_current_revision_id_key" ON "card_listings"("current_revision_id");
CREATE INDEX "card_listings_status_published_at_idx" ON "card_listings"("status", "published_at" DESC);
CREATE INDEX "card_listings_owner_user_id_idx" ON "card_listings"("owner_user_id");

CREATE UNIQUE INDEX "card_revisions_listing_id_version_key" ON "card_revisions"("listing_id", "version");
CREATE INDEX "card_revisions_listing_id_created_at_idx" ON "card_revisions"("listing_id", "created_at" DESC);

CREATE INDEX "card_revision_assets_revision_id_sort_order_idx" ON "card_revision_assets"("revision_id", "sort_order");

CREATE INDEX "card_hearts_user_id_idx" ON "card_hearts"("user_id");

CREATE UNIQUE INDEX "card_uses_forked_event_id_key" ON "card_uses"("forked_event_id");
CREATE UNIQUE INDEX "card_uses_listing_id_user_id_key" ON "card_uses"("listing_id", "user_id");
CREATE INDEX "card_uses_revision_id_idx" ON "card_uses"("revision_id");

CREATE INDEX "events_duplicated_from_event_id_idx" ON "events"("duplicated_from_event_id");
CREATE INDEX "events_forked_from_listing_id_idx" ON "events"("forked_from_listing_id");

-- FKs
ALTER TABLE "events" ADD CONSTRAINT "events_duplicated_from_event_id_fkey" FOREIGN KEY ("duplicated_from_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "card_listings" ADD CONSTRAINT "card_listings_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_listings" ADD CONSTRAINT "card_listings_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_revisions" ADD CONSTRAINT "card_revisions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "card_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_listings" ADD CONSTRAINT "card_listings_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "card_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "card_revision_assets" ADD CONSTRAINT "card_revision_assets_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "card_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_hearts" ADD CONSTRAINT "card_hearts_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "card_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_hearts" ADD CONSTRAINT "card_hearts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_uses" ADD CONSTRAINT "card_uses_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "card_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_uses" ADD CONSTRAINT "card_uses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "card_uses" ADD CONSTRAINT "card_uses_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "card_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_forked_from_listing_id_fkey" FOREIGN KEY ("forked_from_listing_id") REFERENCES "card_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_forked_from_revision_id_fkey" FOREIGN KEY ("forked_from_revision_id") REFERENCES "card_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
