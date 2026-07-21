-- DropIndex
DROP INDEX "event_assets_event_id_idx";

-- AlterTable
ALTER TABLE "event_assets" ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "size_bytes" INTEGER,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'birthday',
ADD COLUMN     "is_premium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mood" TEXT NOT NULL DEFAULT 'cute',
ADD COLUMN     "preview_url" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "required_asset_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "event_assets_event_id_sort_order_idx" ON "event_assets"("event_id", "sort_order");

-- CreateIndex
CREATE INDEX "templates_category_idx" ON "templates"("category");

-- CreateIndex
CREATE INDEX "templates_is_active_sort_order_idx" ON "templates"("is_active", "sort_order");
