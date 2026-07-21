-- CreateTable
CREATE TABLE "creators" (
    "id" UUID NOT NULL,
    "device_token" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "steps_schema" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "event_date" TIMESTAMP(3),
    "template_id" UUID,
    "template_data" JSONB NOT NULL DEFAULT '{}',
    "pin_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_access_logs" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "ip_address" TEXT,
    "success" BOOLEAN NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_assets" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "asset_type" TEXT,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creators_device_token_key" ON "creators"("device_token");

-- CreateIndex
CREATE UNIQUE INDEX "templates_slug_key" ON "templates"("slug");

-- CreateIndex
CREATE INDEX "events_creator_id_idx" ON "events"("creator_id");

-- CreateIndex
CREATE INDEX "events_template_id_idx" ON "events"("template_id");

-- CreateIndex
CREATE INDEX "event_access_logs_event_id_idx" ON "event_access_logs"("event_id");

-- CreateIndex
CREATE INDEX "event_assets_event_id_idx" ON "event_assets"("event_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_access_logs" ADD CONSTRAINT "event_access_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assets" ADD CONSTRAINT "event_assets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
