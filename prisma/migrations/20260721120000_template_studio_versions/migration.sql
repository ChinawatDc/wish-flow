-- Template Studio: immutable versions, event pinning, assets, marketplace metadata, telemetry

CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED');
CREATE TYPE "TemplateMarketplaceVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
CREATE TYPE "TemplateTelemetryKind" AS ENUM ('STEP_START', 'STEP_COMPLETE', 'STEP_SKIP', 'FLOW_COMPLETE');
CREATE TYPE "DeviceClass" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP', 'UNKNOWN');

-- Catalog marketplace + current published pointer (nullable until backfill)
ALTER TABLE "templates"
  ADD COLUMN "current_published_version_id" UUID,
  ADD COLUMN "marketplace_visibility" "TemplateMarketplaceVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "price_label" TEXT,
  ADD COLUMN "price_currency" TEXT,
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "licensing_notes" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "template_versions" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "steps_schema" JSONB NOT NULL,
  "data_model" JSONB NOT NULL DEFAULT '{}',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "sample_data" JSONB NOT NULL DEFAULT '{}',
  "release_notes" TEXT,
  "breaking_change" BOOLEAN NOT NULL DEFAULT false,
  "migration_notes" TEXT,
  "created_by_user_id" UUID,
  "published_by_user_id" UUID,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "template_versions_template_id_version_key" ON "template_versions"("template_id", "version");
CREATE INDEX "template_versions_template_id_status_idx" ON "template_versions"("template_id", "status");

ALTER TABLE "template_versions"
  ADD CONSTRAINT "template_versions_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "template_versions"
  ADD CONSTRAINT "template_versions_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "template_versions"
  ADD CONSTRAINT "template_versions_published_by_user_id_fkey"
  FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "template_assets" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "asset_type" TEXT,
  "url" TEXT NOT NULL,
  "mime_type" TEXT,
  "size_bytes" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "template_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "template_assets_template_id_sort_order_idx" ON "template_assets"("template_id", "sort_order");

ALTER TABLE "template_assets"
  ADD CONSTRAINT "template_assets_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill published v1 from live catalog rows
INSERT INTO "template_versions" (
  "id",
  "template_id",
  "version",
  "status",
  "schema_version",
  "steps_schema",
  "data_model",
  "settings",
  "sample_data",
  "release_notes",
  "breaking_change",
  "published_at",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  t."id",
  1,
  'PUBLISHED'::"TemplateVersionStatus",
  1,
  t."steps_schema",
  '{}'::jsonb,
  jsonb_build_object(
    'mode', 'basic',
    'theme', jsonb_build_object('preset', 'cute-pastel'),
    'motion', jsonb_build_object('intensity', 'normal', 'reducedMotionPolicy', 'honor-prefers')
  ),
  '{}'::jsonb,
  'Initial published snapshot (migrated from catalog)',
  false,
  COALESCE(t."published_at", t."created_at"),
  t."created_at",
  CURRENT_TIMESTAMP
FROM "templates" t;

UPDATE "templates" t
SET
  "current_published_version_id" = v."id",
  "published_at" = COALESCE(t."published_at", v."published_at"),
  "updated_at" = CURRENT_TIMESTAMP
FROM "template_versions" v
WHERE v."template_id" = t."id" AND v."version" = 1 AND v."status" = 'PUBLISHED';

CREATE UNIQUE INDEX "templates_current_published_version_id_key" ON "templates"("current_published_version_id");

ALTER TABLE "templates"
  ADD CONSTRAINT "templates_current_published_version_id_fkey"
  FOREIGN KEY ("current_published_version_id") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pin events to published v1 of their catalog template
ALTER TABLE "events" ADD COLUMN "template_version_id" UUID;

UPDATE "events" e
SET "template_version_id" = t."current_published_version_id"
FROM "templates" t
WHERE e."template_id" = t."id" AND t."current_published_version_id" IS NOT NULL;

CREATE INDEX "events_template_version_id_idx" ON "events"("template_version_id");

ALTER TABLE "events"
  ADD CONSTRAINT "events_template_version_id_fkey"
  FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "template_telemetry_events" (
  "id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "template_version_id" UUID NOT NULL,
  "kind" "TemplateTelemetryKind" NOT NULL,
  "step_key" TEXT,
  "step_type" TEXT,
  "step_index" INTEGER,
  "device_class" "DeviceClass" NOT NULL DEFAULT 'UNKNOWN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "template_telemetry_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "template_telemetry_events_template_version_id_kind_created_at_idx"
  ON "template_telemetry_events"("template_version_id", "kind", "created_at");
CREATE INDEX "template_telemetry_events_event_id_created_at_idx"
  ON "template_telemetry_events"("event_id", "created_at");

ALTER TABLE "template_telemetry_events"
  ADD CONSTRAINT "template_telemetry_events_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_telemetry_events"
  ADD CONSTRAINT "template_telemetry_events_template_version_id_fkey"
  FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
